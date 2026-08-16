import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/error';
import apiRouter from './routes/api';
import prisma from './config/db';

import path from 'path';

// Load Environment Config
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Request Parsing Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to allow external CDNs like Google Fonts, Chart.js, etc.
  })
);
app.use(cors());
app.use(express.json());

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, '../public')));
app.use('/admin/libs/chartjs', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/admin/libs/fontawesome', express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express.static(path.join(__dirname, '../public')));

// API Rate Limiter
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes prefix
app.use('/api/v1', apiRouter);

// Global Error Handler Middleware
app.use(errorHandler);

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
