import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/app.js';

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Normalize rewritten URLs in Vercel Serverless environment
  if (req.url) {
    const forwardedUri = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;
    if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
      req.url = forwardedUri;
    } else if (req.url.startsWith('/api/index')) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const paramPath = urlObj.searchParams.get('__path');
        if (paramPath) {
          req.url = `/api/${paramPath}`;
        }
      } catch {
        // Keep existing req.url
      }
    }
  }

  return new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('close', () => resolve());
    res.on('error', (err) => reject(err));

    try {
      app(req as any, res as any, (err: any) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  }).catch((err: any) => {
    console.error('Unhandled Vercel serverless function invocation error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'SERVERLESS_INVOCATION_ERROR',
        message: err?.message || 'Internal Server Error',
      }));
    }
  });
}


