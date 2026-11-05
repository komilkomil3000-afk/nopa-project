import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { clearAuthCache } from './middleware/auth';
import { clearStationsCache } from './controllers/lmsController';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { apiLimiter } from './middleware/rateLimit';
import { scrubResponses } from './middleware/responseScrubber';
import { cspDirectives } from './config/csp';
import apiRouter from './routes/api';
import { getPublicAppVersion } from './controllers/appReleaseController';

// Load Environment Config
dotenv.config();

const app = express();

// Behind a reverse proxy (nginx etc.) req.ip must be the real client, otherwise every user shares the
// proxy's IP in the rate limiters. 'loopback' trusts X-Forwarded-For only when it comes from a proxy on
// the same machine; a client talking directly can never spoof its IP. Override with TRUST_PROXY
// (a hop count such as "1", or an IP/CIDR list) when the proxy is on another host.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy === undefined || trustProxy === '' ? 'loopback' : (/^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy));

// Top-level Concurrency & Compression Middleware
app.use(compression());

// Security & Request Parsing Middlewares
app.use(
  helmet({
    // CSP for the admin panel: see config/csp.ts
    contentSecurityPolicy: {
      useDefaults: false,
      directives: cspDirectives,
    },
  })
);
// Auth uses bearer tokens (no cookies), so CORS is not a credential boundary. Set CORS_ORIGINS
// (comma-separated) to restrict browsers to specific origins; unset keeps the previous open behaviour.
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : '*' }));
// The bulk user import sends a whole spreadsheet (controllers/userImportController.ts); everything else keeps the 100kb default
app.use('/api/v1/admin/users/import', express.json({ limit: '8mb' }));
app.use(express.json());

// Any write outside chat may change LMS content: drop the short-lived station tree cache.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && /\/(auth|admin|security|users|mentors)\b/.test(req.path)) {
    res.on('finish', clearAuthCache);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && !req.path.includes('/chat')) {
    // Cleared on both ends: 'finish' can fire after the client already got the reply and re-read the
    // stations (it would then get the cached, pre-write tree); clearing first also stops a read that
    // overlaps the write from re-caching for long, and 'finish' drops whatever that read cached.
    clearStationsCache();
    res.on('finish', clearStationsCache);
  }
  next();
});

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

// Never let password hashes / token versions leave the server, whatever a controller returns
app.use('/api/', scrubResponses);

// Health check endpoint
app.get(['/health', '/api/v1/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Public: the newest app release, for the in-app "check for updates".
// Set from the panel (roles & security tab → «نسخه اپلیکیشن»); the APP_LATEST_VERSION env vars are only a fallback.
app.get('/api/v1/app/version', getPublicAppVersion);

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
    error: process.env.NODE_ENV === 'production' && process.env.EXPOSE_ERRORS !== '1' ? undefined : err.message
  });
});

export default app;
export { app };
