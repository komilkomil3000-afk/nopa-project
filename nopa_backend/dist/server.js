"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const db_1 = __importDefault(require("./config/db"));
// Load Environment Config
dotenv_1.default.config();
// Process protection against unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [Process Protection] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('🚨 [Process Protection] Uncaught Exception thrown:', error);
});
const PORT = process.env.PORT || 5000;
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
app_1.default.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OFFLINE SERVER ACTIVE] Admin CRM live at: http://localhost:${PORT}/admin`);
    console.log(`🚀 Nopa Backend Service is running on http://0.0.0.0:${PORT}`);
    console.log(`🏥 Health check at http://0.0.0.0:${PORT}/health`);
    // Run audit log TTL cleanup on startup and schedule every hour
    runAuditLogCleanup();
    setInterval(runAuditLogCleanup, 3600000);
});
