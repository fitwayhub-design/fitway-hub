import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Log full error server-side only — never send stack/details to client
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err.stack || err.message);
  } else {
    console.error('[ERROR]', err.message || 'Unknown error');
  }

  const status = typeof err.status === 'number' ? err.status : 500;

  res.status(status).json({
    message: status < 500 ? (err.message || 'Request failed') : 'Something went wrong. Please try again.',
  });
};
