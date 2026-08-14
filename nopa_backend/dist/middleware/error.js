"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    console.error('Global Error Handler caught:', err);
    const status = err.statusCode || 500;
    const message = err.message || 'خطای غیرمنتظره‌ای در سرور رخ داد';
    res.status(status).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}
