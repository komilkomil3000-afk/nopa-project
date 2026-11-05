import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../middleware/auth';
import { canUseChat, getChatSettings } from '../../services/chatSettings';
import { isChannelManagerRole } from '../../utils/roles';
import { visibleSpaceIds } from './service';
import { loadActor } from './access';
import prisma from '../../config/db';

let io: Server | null = null;
const REVALIDATE_MS = 5 * 60 * 1000;

/**
 * The client's IP under the same 'trust proxy' rule as HTTP requests (app.ts). Behind nginx the socket
 * address is the proxy's, so the IP blacklist would never match without this.
 */
function clientIp(socket: Socket): string {
  const remote = socket.request.socket.remoteAddress || socket.handshake.address || 'unknown';
  // Loaded on use: app.ts imports the chat routes, which lead back here
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const app = require('../../app').default as import('express').Express;
  const trust = app.get('trust proxy fn') as ((addr: string, i: number) => boolean) | undefined;
  const header = socket.handshake.headers['x-forwarded-for'];
  if (!trust || !header) return remote;
  const forwarded = String(header).split(',').map(a => a.trim()).filter(Boolean).reverse();
  const chain = [remote, ...forwarded];
  let i = 0;
  while (i < chain.length - 1 && trust(chain[i], i)) i++;
  return chain[i];
}

export function emitToSpace(spaceId: string, event: string, payload: unknown): void {
  io?.to(`space:${spaceId}`).emit(event, payload);
}

/** To these people only, in any space: for content not everyone in the space may see. */
export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io || userIds.length === 0) return;
  io.to(userIds.map(id => `user:${id}`)).emit(event, payload);
}

/** To every connected app: for news everyone may know, such as «the rankings changed». */
export function emitToAll(event: string, payload: unknown): void {
  io?.emit(event, payload);
}

export function isOnline(userId: string): boolean {
  return (io?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) > 0;
}

/** Everyone with at least one live socket. */
export function onlineUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const room of io?.sockets.adapter.rooms.keys() ?? []) if (room.startsWith('user:')) ids.add(room.slice(5));
  return ids;
}

/** Tells the spaces of a user that they came online or went away (first socket in, last socket out). */
function announcePresence(socket: Socket, userId: string, online: boolean): void {
  for (const room of socket.rooms) {
    if (room.startsWith('space:')) socket.to(room).emit('presence', { spaceId: room.slice(6), userId, online });
  }
}

/** Puts a socket in the room of every space its user can see, and only those. */
async function syncRooms(socket: Socket, userId: string): Promise<boolean> {
  const actor = await loadActor(userId);
  if (!actor) return false;
  const allowed = new Set((await visibleSpaceIds(actor)).map(id => `space:${id}`));
  for (const room of socket.rooms) {
    if (room.startsWith('space:') && !allowed.has(room)) socket.leave(room);
  }
  socket.join(Array.from(allowed));
  return true;
}

/** Checks a live socket again: the token, the admin's switch and what its user may see. */
async function revalidate(socket: Socket): Promise<void> {
  const check = await verifyAccessToken(socket.data.token, socket.data.ip);
  if (!check.ok) { socket.disconnect(true); return; }
  const actor = await loadActor(check.user.id);
  if (!actor || !canUseChat(actor, await getChatSettings())) { socket.disconnect(true); return; }
  await syncRooms(socket, check.user.id);
}

/** After the switch or the role access changed: applies it to everyone connected, right away. */
export async function revalidateAllSockets(): Promise<void> {
  if (!io) return;
  await Promise.all(Array.from(io.sockets.sockets.values()).map(s => revalidate(s).catch(e => console.error('chat revalidate error:', e))));
}

/** A new space exists for these users: lets their open sockets join it. */
export async function refreshUserRooms(userIds: string[]): Promise<void> {
  if (!io) return;
  for (const userId of userIds) {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    for (const remote of sockets) {
      const socket = io.sockets.sockets.get(remote.id);
      if (socket) await syncRooms(socket, userId).catch(e => console.error('chat room sync error:', e));
    }
  }
}

export function attachChatSocket(server: HttpServer): void {
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  io = new Server(server, { cors: origins.length ? { origin: origins } : undefined, maxHttpBufferSize: 16 * 1024 });

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '');
      const ip = clientIp(socket);
      const check = await verifyAccessToken(token, ip);
      if (!check.ok) return next(new Error('UNAUTHORIZED'));
      const actor = await loadActor(check.user.id);
      if (!actor || !canUseChat(actor, await getChatSettings())) return next(new Error('CHAT_DISABLED'));
      socket.data = { userId: actor.id, name: actor.name, token, ip };
      next();
    } catch (e) {
      console.error('chat socket auth error:', e);
      next(new Error('SERVER_ERROR'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, name } = socket.data;
    socket.join(`user:${userId}`);
    try {
      await syncRooms(socket, userId);
      socket.emit('ready');
      if ((io?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) === 1) announcePresence(socket, userId, true);
    } catch (e) {
      console.error('chat socket join error:', e);
      socket.disconnect(true);
      return;
    }

    socket.on('disconnecting', () => {
      if ((io?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) <= 1) {
        announcePresence(socket, userId, false);
        // "last seen" on the panel's person page
        prisma.user.update({ where: { id: userId }, data: { lastActiveTimestamp: new Date() } }).catch(() => {});
      }
    });

    socket.on('typing', (spaceId: unknown) => {
      if (typeof spaceId === 'string' && socket.rooms.has(`space:${spaceId}`)) {
        socket.to(`space:${spaceId}`).emit('typing', { spaceId, userId, name });
      }
    });
  });

  const timer = setInterval(() => { revalidateAllSockets(); }, REVALIDATE_MS);
  timer.unref();
}

export async function closeChatSocket(): Promise<void> {
  if (!io) return;
  io.disconnectSockets(true);
  io = null;
}
