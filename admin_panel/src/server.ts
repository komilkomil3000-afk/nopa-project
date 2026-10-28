import dotenv from 'dotenv';
import app from './app';
import prisma from './config/db';

// Load Environment Config
dotenv.config();

// Process protection against unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 [Process Protection] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('🚨 [Process Protection] Uncaught Exception thrown:', error);
});

const PORT = process.env.PORT || 5000;

async function runAuditLogCleanup() {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: threeDaysAgo
        }
      }
    });
    console.log(`[AuditLog TTL] Purged ${result.count} logs older than 3 days.`);
  } catch (error) {
    console.error('AuditLog TTL cleanup failed:', error);
  }
}

// Start server on all network interfaces so devices on the same LAN can reach it.
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[OFFLINE SERVER ACTIVE] Admin CRM live at: http://localhost:${PORT}/admin`);
  console.log(`🚀 Nopa Backend Service is running on http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check at http://0.0.0.0:${PORT}/health`);
  
  // Run audit log TTL cleanup on startup and schedule every hour
  runAuditLogCleanup();
  setInterval(runAuditLogCleanup, 3600000);
});
