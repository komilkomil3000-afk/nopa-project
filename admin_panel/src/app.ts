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
    // CSP for the admin panel. The panel still uses inline scripts/handlers, so 'unsafe-inline'
    // is required for now; the important parts are: no third-party scripts, no connections to
    // other origins (an injected script cannot send the token elsewhere via fetch/XHR),
    // no plugins/objects, no framing by other sites, and forms only to this origin.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.aparat.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: '*' }));
app.use(express.json());

// Public static files & uploads (Placed before authentication / JWT middleware)
// Uploads are user-controlled. They are served from the same origin as the admin panel, so they
// must never be able to run as active content: nosniff + a sandboxing CSP on everything, and
// forced download for anything that is not a plain image/audio/video file.
const INLINE_UPLOAD_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp3', '.m4a', '.aac', '.ogg', '.wav', '.3gp', '.amr',
  '.mp4', '.webm', '.mov',
]);
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (ext !== '.pdf') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      }
      if (!INLINE_UPLOAD_EXT.has(ext) && ext !== '.pdf') {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  })
);

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, '../public')));
app.use('/admin/libs/chartjs', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/admin/libs/fontawesome', express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express.static(path.join(__dirname, '../public')));

// General API Rate Limiter (1000 requests per 15 minutes per IP)
app.use('/api/', apiLimiter);

// Health check endpoint
app.get(['/health', '/api/v1/health'], (req, res) => {
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
