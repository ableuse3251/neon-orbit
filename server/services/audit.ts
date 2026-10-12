import { query, isDbActive } from '../db.js';

/**
 * Service to record administrative actions into the audit_log table.
 */
export async function logAdminAction(
  adminId: bigint | number | string,
  action: string,
  targetId?: string,
  details: any = {}
): Promise<void> {
  if (!isDbActive()) return;
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [adminId, action, targetId || null, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
