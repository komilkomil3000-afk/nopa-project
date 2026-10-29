import dotenv from 'dotenv';
import app from './app';
import prisma from './config/db';
import { assertSecretsConfigured } from './config/secrets';

// Load Environment Config
dotenv.config();

// Fail fast: refuse to start without strong, non-default JWT secrets
assertSecretsConfigured();

// Process protection against unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 [Process Protection] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
  // State is undefined after an uncaught exception: log, then exit so pm2 restarts a clean process
  console.error('🚨 [Process Protection] Uncaught Exception thrown:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

// Retention: high-volume login noise is short-lived (the 1-hour login limit only needs recent rows);
// admin/action history is kept long enough to investigate incidents.
const LOGIN_LOG_RETENTION_DAYS = 3;
const AUDIT_LOG_RETENTION_DAYS = Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 180;

async function runAuditLogCleanup() {
  try {
    const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const logins = await prisma.auditLog.deleteMany({
      where: { action: 'USER_LOGIN', createdAt: { lt: daysAgo(LOGIN_LOG_RETENTION_DAYS) } }
    });
    const others = await prisma.auditLog.deleteMany({
      where: { action: { not: 'USER_LOGIN' }, createdAt: { lt: daysAgo(AUDIT_LOG_RETENTION_DAYS) } }
    });
    console.log(`[AuditLog TTL] Purged ${logins.count} login logs and ${others.count} other logs.`);
  } catch (error) {
    console.error('AuditLog TTL cleanup failed:', error);
  }
}

// Start server on all network interfaces so devices on the same LAN can reach it.
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[OFFLINE SERVER ACTIVE] Admin CRM live at: http://localhost:${PORT}/admin`);
  console.log(`🚀 Nopa Backend Service is running on http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check at http://0.0.0.0:${PORT}/health`);
  
  // Run audit log TTL cleanup on startup and schedule every hour
  runAuditLogCleanup();
  setInterval(runAuditLogCleanup, 3600000);
});

// Graceful shutdown (pm2 restart sends SIGINT/SIGTERM): stop accepting, finish in-flight, close DB
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Shutdown] ${signal} received, closing server...`);
  const force = setTimeout(() => process.exit(1), 10000);
  force.unref();
  server.close(async () => {
    try { await prisma.$disconnect(); } catch (e) { console.error(e); }
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
