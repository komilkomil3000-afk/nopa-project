"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const rateLimit_1 = require("./middleware/rateLimit");
const error_1 = require("./middleware/error");
const api_1 = __importDefault(require("./routes/api"));
const db_1 = __importDefault(require("./config/db"));
const path_1 = __importDefault(require("path"));
// Load Environment Config
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security & Request Parsing Middlewares
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP to allow external CDNs like Google Fonts, Chart.js, etc.
}));
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
// Serve static admin files
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/admin/libs/chartjs', express_1.default.static(path_1.default.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/admin/libs/fontawesome', express_1.default.static(path_1.default.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// API Rate Limiter
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
// Global Error Handler Middleware
app.use(error_1.errorHandler);
async function runAuditLogCleanup() {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const result = await db_1.default.auditLog.deleteMany({
            where: {
                createdAt: {
                    lt: threeDaysAgo
                }
            }
        });
        console.log(`[AuditLog TTL] Purged ${result.count} logs older than 3 days.`);
    }
    catch (error) {
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
