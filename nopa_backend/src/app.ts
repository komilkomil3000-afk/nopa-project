import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { apiLimiter } from './middleware/rateLimit';
import apiRouter from './routes/api';

// Load Environment Config
dotenv.config();

const app = express();

// Top-level Concurrency & Compression Middleware
app.use(compression());

// Security & Request Parsing Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to allow external CDNs like Google Fonts, Chart.js, etc.
  })
);
app.use(cors({ origin: '*' }));
app.use(express.json());

// Public static files & uploads (Placed before authentication / JWT middleware)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, '../public')));
app.use('/admin/libs/chartjs', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/admin/libs/fontawesome', express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express.static(path.join(__dirname, '../public')));

// General API Rate Limiter (1000 requests per 15 minutes per IP)
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes prefix
app.use('/api/admin/lms/stations', (req, res) => {
  res.redirect(307, `/api/v1/lms/stations${req.url === '/' ? '' : req.url}`);
});
app.use('/api/v1', apiRouter);

// Centralized Error-Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || err.statusCode || 500).json({
    success: false,
    message: 'Internal server error occurred',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

export default app;
export { app };
