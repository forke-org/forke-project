'use server'

import { db } from '@/lib/db'
import { adminAuditLog, users, subscribers, supportEnquiries, tasks, submissions } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { getCurrentAdmin } from '@/lib/admin-actions'
import { isActivityLogLive, setActivityLogLive } from '@/lib/db/settings'

export type ActivityCategory =
  | 'admin' | 'user' | 'owner' | 'db' | 'support' | 'task' | 'system' | 'error'

export interface ActivityEvent {
  id: string
  category: ActivityCategory
  action: string
  actor: string | null
  target: string | null
  createdAt: string // ISO
  ts: number
}

// Creates the audit table on demand (matches the project's runtime-migration pattern).
export async function ensureAuditLogTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "admin_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid,
        "actor_name" text,
        "category" text NOT NULL DEFAULT 'admin',
        "action" text NOT NULL,
        "target" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log" ("created_at");
    `)
  } catch (e) {
    console.error('ensureAuditLogTable failed:', e)
  }
}

interface LogEntry {
  action: string
  category?: ActivityCategory
  target?: string | null
  metadata?: Record<string, unknown> | null
  actorName?: string | null
  actorId?: string | null
}

/** Records an admin action. Best-effort — never throws into the caller. */
export async function logAudit(entry: LogEntry) {
  try {
    await ensureAuditLogTable()
    let actorId = entry.actorId ?? null
    let actorName = entry.actorName ?? null
    if (!actorName) {
      const admin = await getCurrentAdmin().catch(() => null)
      if (admin) {
        actorId = admin.id
        actorName = admin.name
      }
    }
    await db.insert(adminAuditLog).values({
      actorId,
      actorName,
      category: entry.category ?? 'admin',
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? null,
    })

    // Continuous background pruning of logs older than 7 days (168 hours) - best effort
    db.delete(adminAuditLog)
      .where(sql`created_at < now() - interval '7 days'`)
      .catch((err) => console.error('Failed to auto-prune audit logs:', err))
  } catch (e) {
    console.error('logAudit failed:', e)
  }
}

/** Server Action: Manually purge all logs from the database. Only accessible to Super Admins. */
export async function purgeAuditLogsAction() {
  const admin = await getCurrentAdmin().catch(() => null)
  if (!admin || admin.role !== 'super_admin') {
    return { success: false, error: 'Only Super Admins can purge audit logs.' }
  }
  try {
    await db.delete(adminAuditLog)
    
    // Log the purge action itself so admins know it was cleared
    await logAudit({
      category: 'system',
      action: 'system.logs_purged',
      target: 'All logs'
    })
    return { success: true }
  } catch (e: any) {
    console.error('Failed to purge logs:', e)
    return { success: false, error: e.message || 'Failed to purge logs.' }
  }
}

/** Server Action: Get global live activity log feed status. */
export async function getActivityLogLiveStatusAction() {
  try {
    const live = await isActivityLogLive()
    return { success: true, live }
  } catch (e: any) {
    console.error('Failed to get activity log live status:', e)
    return { success: false, error: e.message || 'Failed to query live status.' }
  }
}

/** Server Action: Set global live activity log feed status. Only Super Admins can execute. */
export async function setActivityLogLiveStatusAction(live: boolean) {
  const admin = await getCurrentAdmin().catch(() => null)
  if (!admin || admin.role !== 'super_admin') {
    return { success: false, error: 'Only Super Admins can configure the live activity status.' }
  }
  try {
    await setActivityLogLive(live)
    await logAudit({
      category: 'system',
      action: live ? 'system.logs_live_enabled' : 'system.logs_live_paused',
      target: 'Activity Log Feed'
    })
    return { success: true }
  } catch (e: any) {
    console.error('Failed to set activity log live status:', e)
    return { success: false, error: e.message || 'Failed to update live status.' }
  }
}


const ev = (
  id: string,
  category: ActivityCategory,
  action: string,
  actor: string | null,
  target: string | null,
  createdAt: Date,
): ActivityEvent => ({
  id,
  category,
  action,
  actor,
  target,
  createdAt: createdAt.toISOString(),
  ts: createdAt.getTime(),
})

/**
 * The unified activity feed: explicitly-logged admin actions merged with
 * derived system events (signups, subscribers, enquiries, tasks…) read straight
 * from existing tables — so it reflects "everything happening" without having to
 * instrument the rest of the app.
 */
export async function getActivityFeed(opts?: { category?: ActivityCategory | 'all'; limit?: number }) {
  const limit = opts?.limit ?? 120
  const events: ActivityEvent[] = []

  try {
    await ensureAuditLogTable()

    // 1) Logged admin & system actions
    const query = db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt))
    const logged = await query

    for (const r of logged) {
      events.push(ev(`log-${r.id}`, (r.category as ActivityCategory) || 'admin', r.action, r.actorName, r.target, r.createdAt))
    }

    // Filter by category if specified
    const filtered = !opts?.category || opts.category === 'all'
      ? events
      : events.filter((e) => e.category === opts.category)

    return { success: true, events: filtered.slice(0, limit) }
  } catch (e) {
    console.error('getActivityFeed failed:', e)
    return { success: false, events: [] as ActivityEvent[], error: 'Failed to load activity' }
  }
}
