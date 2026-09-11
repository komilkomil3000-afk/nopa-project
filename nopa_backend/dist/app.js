"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const rateLimit_1 = require("./middleware/rateLimit");
const api_1 = __importDefault(require("./routes/api"));
// Load Environment Config
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
// Top-level Concurrency & Compression Middleware
app.use((0, compression_1.default)());
// Security & Request Parsing Middlewares
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP to allow external CDNs like Google Fonts, Chart.js, etc.
}));
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
// Public static files & uploads (Placed before authentication / JWT middleware)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Serve static admin files
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/admin/libs/chartjs', express_1.default.static(path_1.default.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/admin/libs/fontawesome', express_1.default.static(path_1.default.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// General API Rate Limiter (1000 requests per 15 minutes per IP)
app.use('/api/', rateLimit_1.apiLimiter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// API Routes prefix
app.use('/api/admin/lms/stations', (req, res) => {
    res.redirect(307, `/api/v1/lms/stations${req.url === '/' ? '' : req.url}`);
});
app.use('/api/v1', api_1.default);
// Centralized Error-Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || err.statusCode || 500).json({
        success: false,
        message: 'Internal server error occurred',
        error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});
exports.default = app;
