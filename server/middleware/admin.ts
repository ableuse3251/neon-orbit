import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/**
 * Middleware to enforce admin authorization on protected routes.
 * Checks that req.user.id is included in ADMIN_TELEGRAM_IDS.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    return;
  }

  const isAdmin =
    config.adminTelegramIds.some((adminId) => String(adminId) === String(user.id)) || Boolean(user.isAdmin);

  if (!isAdmin) {
    res.status(403).json({ error: 'Access denied: Admin authorization required.' });
    return;
  }

  next();
}
