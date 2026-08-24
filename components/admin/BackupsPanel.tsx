'use client'

import React, { useState, useEffect } from 'react'
import { getBackupRuns, getBackupStats, type BackupRun } from '@/lib/actions/backup-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { RefreshCw, CheckCircle2, XCircle, Clock, Archive, Shield } from 'lucide-react'
import { toast } from '@/components/shared/Toast'

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const TIER_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export default function BackupsPanel() {
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [stats, setStats] = useState<{ lastSuccess?: string | null; lastRun?: string | null; successCount?: number; failureCount?: number }>({})
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [runsRes, statsRes] = await Promise.all([getBackupRuns(), getBackupStats()])
    if (runsRes.success) {
      setRuns(runsRes.runs || [])
    } else {
      toast(runsRes.error || 'Failed to load backup history.', 'error')
    }
    if (statsRes.success) {
      setStats(statsRes)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <PanelSkeleton />
  }

  const lastSuccessStale =
    stats.lastSuccess && Date.now() - new Date(stats.lastSuccess).getTime() > 2 * 24 * 60 * 60 * 1000

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 text-left select-none bg-[#070709] text-white font-sans h-full min-h-0">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Database backups
          </h1>
          <p className="text-xs text-white/40">Daily automated backups with 7-day / 4-week / 6-month retention, stored offsite on R2.</p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-lg text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className={`bg-[#0b0b0e] border rounded-xl p-4 space-y-2 ${lastSuccessStale ? 'border-red-500/30' : 'border-white/[0.06]'}`}>
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Last Successful</span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${lastSuccessStale ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div className="text-sm font-mono font-bold text-white">{formatDate(stats.lastSuccess ?? null)}</div>
          {lastSuccessStale && <div className="text-[9px] text-red-400">No successful backup in 2+ days</div>}
        </div>

        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Last Run</span>
            <Clock className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-sm font-mono font-bold text-white">{formatDate(stats.lastRun ?? null)}</div>
        </div>

        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Successful (90d)</span>
            <Archive className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">{stats.successCount ?? 0}</div>
        </div>

        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Failed (90d)</span>
            <Shield className={`w-3.5 h-3.5 ${(stats.failureCount ?? 0) > 0 ? 'text-red-400' : 'text-white/30'}`} />
          </div>
          <div className={`text-lg font-mono font-bold ${(stats.failureCount ?? 0) > 0 ? 'text-red-400' : 'text-white'}`}>{stats.failureCount ?? 0}</div>
        </div>
      </div>

      <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#0b0b0e]">
        <table className="w-full border-collapse font-sans text-xs text-left">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold">
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Triggered By</th>
              <th className="px-4 py-3 text-right">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                  No backup runs recorded yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3.5 text-white/80 font-mono">{formatDate(run.startedAt)}</td>
                  <td className="px-4 py-3.5">
                    <span className="bg-white/[0.03] border border-white/[0.06] text-white/60 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {TIER_LABEL[run.tier] || run.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {run.status === 'success' ? (
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1.5 w-max">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </span>
                    ) : (
                      <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1.5 w-max">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-white/60 font-mono">{formatBytes(run.sizeBytes)}</td>
                  <td className="px-4 py-3.5 text-white/60 font-mono">{run.triggeredBy || 'cron'}</td>
                  <td className="px-4 py-3.5 text-right text-red-400/70 font-mono text-[10px] max-w-[200px] truncate" title={run.errorMessage || ''}>
                    {run.errorMessage || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
