import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { backupRuns } from '@/lib/db/schema'
import { getPresignedDownloadUrl } from '@/lib/r2'
import { sendDatabaseBackupNotification, sendBackupFailureAlert } from '@/lib/email'
import { logAudit } from '@/lib/actions/audit-actions'

export const dynamic = 'force-dynamic'

// Called by the backup script running on the OCI DB host after each pg_dump run
// (scheduled daily via crontab, or a manual "Run now" trigger from the admin panel).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : null
  const secret = process.env.BACKUP_WEBHOOK_SECRET

  if (!secret || token !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      status,
      tier,
      sizeBytes,
      r2Key,
      triggeredBy,
      errorMessage,
    }: {
      status: 'success' | 'failed'
      tier: string
      sizeBytes?: number
      r2Key?: string
      triggeredBy?: string
      errorMessage?: string
    } = body

    if (!status || !tier) {
      return NextResponse.json({ success: false, error: 'Missing status or tier' }, { status: 400 })
    }

    await db.insert(backupRuns).values({
      status,
      tier,
      sizeBytes: sizeBytes ?? null,
      r2Key: r2Key ?? null,
      triggeredBy: triggeredBy ?? 'cron',
      errorMessage: errorMessage ?? null,
      finishedAt: new Date(),
    })

    await logAudit({
      category: 'db',
      action: status === 'success' ? 'database.backup_generated' : 'database.backup_failed',
      target:
        status === 'success'
          ? `${tier} backup uploaded to R2 (${r2Key}), ${sizeBytes ? Math.round(sizeBytes / 1024) + ' KB' : ''}`
          : `${tier} backup FAILED: ${errorMessage}`,
    })

    if (status === 'success' && r2Key) {
      const downloadUrl = await getPresignedDownloadUrl(r2Key, 43200)
      const expiryDate = new Date(Date.now() + 12 * 60 * 60 * 1000)
      const expiryTimeIST =
        expiryDate.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST'
      await sendDatabaseBackupNotification(downloadUrl, expiryTimeIST)
    } else if (status === 'failed') {
      await sendBackupFailureAlert(tier, errorMessage || 'Unknown error')
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Backup report route error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to record backup' }, { status: 500 })
  }
}
