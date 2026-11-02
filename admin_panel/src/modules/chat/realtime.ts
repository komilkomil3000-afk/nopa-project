import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../middleware/auth';
import { canUseChat, getChatSettings } from '../../services/chatSettings';
import { isChannelManagerRole } from '../../utils/roles';
import { visibleSpaceIds } from './service';
import { loadActor } from './access';

let io: Server | null = null;
const REVALIDATE_MS = 5 * 60 * 1000;

export function emitToSpace(spaceId: string, event: string, payload: unknown): void {
  io?.to(`space:${spaceId}`).emit(event, payload);
}

export function isOnline(userId: string): boolean {
  return (io?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) > 0;
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
      const ip = socket.handshake.address || 'unknown';
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
    } catch (e) {
      console.error('chat socket join error:', e);
      socket.disconnect(true);
      return;
    }

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
