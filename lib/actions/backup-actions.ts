'use server'

import { db } from '@/lib/db'
import { backupRuns } from '@/lib/db/schema'
import { desc, sql } from 'drizzle-orm'
import { isAdminAuthenticated } from '@/lib/admin-actions'

export interface BackupRun {
  id: string
  startedAt: string
  finishedAt: string | null
  status: string
  tier: string
  sizeBytes: number | null
  r2Key: string | null
  triggeredBy: string | null
  errorMessage: string | null
}

export async function getBackupRuns(): Promise<{ success: boolean; runs?: BackupRun[]; error?: string }> {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const rows = await db
      .select()
      .from(backupRuns)
      .orderBy(desc(backupRuns.startedAt))
      .limit(90)

    return {
      success: true,
      runs: rows.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        status: r.status,
        tier: r.tier,
        sizeBytes: r.sizeBytes,
        r2Key: r.r2Key,
        triggeredBy: r.triggeredBy,
        errorMessage: r.errorMessage,
      })),
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to load backup history.' }
  }
}

export async function getBackupStats(): Promise<{
  success: boolean
  lastSuccess?: string | null
  lastRun?: string | null
  successCount?: number
  failureCount?: number
  error?: string
}> {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const [row] = await db.execute<any>(sql`
      SELECT
        (SELECT MAX(started_at) FROM backup_runs WHERE status = 'success') AS last_success,
        (SELECT MAX(started_at) FROM backup_runs) AS last_run,
        (SELECT COUNT(*) FROM backup_runs WHERE status = 'success' AND started_at > now() - interval '90 days') AS success_count,
        (SELECT COUNT(*) FROM backup_runs WHERE status = 'failed' AND started_at > now() - interval '90 days') AS failure_count
    `) as any

    return {
      success: true,
      lastSuccess: row?.last_success ? new Date(row.last_success).toISOString() : null,
      lastRun: row?.last_run ? new Date(row.last_run).toISOString() : null,
      successCount: Number(row?.success_count || 0),
      failureCount: Number(row?.failure_count || 0),
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to load backup stats.' }
  }
}
