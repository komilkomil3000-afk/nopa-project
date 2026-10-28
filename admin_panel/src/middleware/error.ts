import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Global Error Handler caught:', err);
  
  const status = err.statusCode || 500;
  const message = err.message || 'خطای غیرمنتظره‌ای در سرور رخ داد';
  
  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
