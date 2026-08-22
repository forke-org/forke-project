import { auth } from '@/auth'
import TopBar from '@/components/shared/TopBar'
import { db } from '@/lib/db'
import { tasks, submissions } from '@/lib/db/schema'
import { eq, sql, and, gte } from 'drizzle-orm'
import { BarChart3, TrendingUp, Clock, CheckCircle2, Zap, Target, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function AnalyticsPage() {
  const session = await auth()
  const sessionUser = session?.user as { id: string; role: 'developer' | 'owner' } | undefined

  if (!sessionUser) return null

  const isOwner = sessionUser.role === 'owner'

  // ─── Fetch real counts ────────────────────────────────────────────────────
  let dbStats = { openCount: 0, completedCount: 0, submittedCount: 0, claimedCount: 0, totalCount: 0 }

  // Monthly task creation counts for last 6 months
  type MonthBucket = { month: string; count: number; budget: number }
  let monthlyData: MonthBucket[] = []

  try {
    const whereClause = isOwner
      ? eq(tasks.clientId, sessionUser.id)
      : eq(tasks.claimantId, sessionUser.id)

    // Monthly breakdown – last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const [res, monthlyRes] = await Promise.all([
      db
        .select({
          status: tasks.status,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(whereClause)
        .groupBy(tasks.status),
      db
        .select({
          month: sql<string>`to_char(created_at, 'Mon')`,
          monthNum: sql<number>`extract(month from created_at)::int`,
          count: sql<number>`count(*)::int`,
          budget: sql<number>`coalesce(sum(budget),0)::int`,
        })
        .from(tasks)
        .where(and(whereClause, gte(tasks.createdAt, sixMonthsAgo)))
        .groupBy(sql`to_char(created_at, 'Mon'), extract(month from created_at)`)
        .orderBy(sql`extract(month from created_at)`),
    ])

    for (const r of res) {
      dbStats.totalCount += r.count
      if (r.status === 'open')      dbStats.openCount      = r.count
      if (r.status === 'approved')  dbStats.completedCount = r.count
      if (r.status === 'submitted') dbStats.submittedCount = r.count
      if (r.status === 'claimed')   dbStats.claimedCount   = r.count
    }

    monthlyData = monthlyRes.map(r => ({ month: r.month, count: r.count, budget: r.budget }))
  } catch (e) {
    console.error('Failed to query analytics data:', e)
  }

  // Fill missing months with 0
  const currentMonth = new Date().getMonth() + 1
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const last6Months: MonthBucket[] = []
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i
    if (m <= 0) m += 12
    const label = MONTHS[m - 1]
    const found = monthlyData.find(x => x.month === label)
    last6Months.push(found ?? { month: label, count: 0, budget: 0 })
  }

  const maxBudget = Math.max(...last6Months.map(d => d.budget), 1)
  const maxCount  = Math.max(...last6Months.map(d => d.count),  1)

  const completionRate = dbStats.totalCount > 0
    ? Math.round((dbStats.completedCount / dbStats.totalCount) * 100)
    : 0

  const pendingReviewCount = dbStats.submittedCount

  const statCards = [
    {
      label: isOwner ? 'Completion rate' : 'Tasks completed',
      value: isOwner ? `${completionRate}%` : `${dbStats.completedCount}`,
      hint: isOwner ? 'Of all posted tasks' : 'Verified shipments',
      icon: Target,
      href: '/submissions',
    },
    {
      label: isOwner ? 'Pending reviews' : 'Active tasks',
      value: `${isOwner ? pendingReviewCount : dbStats.claimedCount}`,
      hint: isOwner ? 'Awaiting your action' : 'In progress',
      icon: Clock,
      href: '/submissions',
    },
    {
      label: isOwner ? 'Total tasks' : 'Total claimed',
      value: `${dbStats.totalCount}`,
      hint: isOwner ? 'All-time posted' : 'Lifetime tasks taken',
      icon: Zap,
      href: '/tasks',
    },
    {
      label: isOwner ? 'Open tasks' : 'Submissions pending',
      value: `${isOwner ? dbStats.openCount : dbStats.submittedCount}`,
      hint: isOwner ? 'Awaiting developers' : 'Awaiting review',
      icon: BarChart3,
      href: isOwner ? '/tasks?filter=unclaimed' : '/tasks',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-transparent text-white font-sans">
      <TopBar title="Analytics" />

      <div className="flex-grow overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 md:px-8 py-6 md:py-8 space-y-6 select-none w-full">
        {/* Header */}
        <div className="space-y-1 text-left">
          <h2 className="text-xl md:text-2xl font-medium text-white tracking-tight">
            Analytics
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xl leading-relaxed">
            {isOwner
              ? 'Insights on your task throughput, escrow flow, and developer response.'
              : 'Track your task activity and approval velocity across claimed tasks.'}
          </p>
        </div>

        {/* 4-Card Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                href={card.href}
                className="group rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 text-left hover:border-accent/40 hover:bg-accent/[0.03] transition-all duration-200 block cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)] group-hover:text-white/70 transition-colors">{card.label}</span>
                  <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-accent transition-colors" />
                </div>
                <div className="mt-3">
                  <h3 className="ui-kpi group-hover:text-accent transition-colors">{card.value}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-[var(--color-text-muted)]">{card.hint}</p>
                    <span className="text-[10px] text-accent/0 group-hover:text-accent/70 transition-colors font-medium flex items-center gap-0.5">
                      View →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-left">
          {/* Monthly bar chart */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-5 md:col-span-8 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
            <div>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h4 className="text-sm font-medium text-white">Task activity</h4>
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
                    {isOwner ? 'Tasks posted per month (last 6 months)' : 'Tasks claimed per month (last 6 months)'}
                  </p>
                </div>
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>

              {/* Chart Bars */}
              <div className="flex items-end justify-between gap-3 h-44 pt-6">
                {last6Months.map((d) => {
                  const pct = Math.max((d.count / maxCount) * 100, d.count > 0 ? 10 : 2)
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center gap-2.5 group/bar">
                      <div className="relative w-full h-36 bg-white/[0.02] border border-[var(--color-border)] rounded-t-lg flex items-end overflow-hidden">
                        <div
                          className="w-full bg-accent/80 rounded-t-md transition-all duration-700 origin-bottom group-hover/bar:bg-accent"
                          style={{ height: `${pct}%` }}
                        />
                        {d.count > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            <span className="text-[11px] font-medium text-white bg-black/70 rounded px-1.5 py-0.5 tabular-nums">
                              {d.count}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--color-text-muted)] group-hover/bar:text-white transition-colors">{d.month}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* No data indicator */}
            {dbStats.totalCount === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-transparent/80">
                <AlertTriangle className="w-5 h-5 text-[var(--color-text-muted)]" />
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  No data yet — {isOwner ? 'post your first task' : 'claim your first task'}
                </p>
              </div>
            )}
          </div>

          {/* Breakdown sidebar */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] md:col-span-4">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h4 className="text-sm font-medium text-white">Breakdown</h4>
            </div>
            <div className="divide-y divide-[var(--color-border)] text-[13px]">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--color-text-muted)]"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed</span>
                <span className="text-white font-medium tabular-nums">{dbStats.completedCount}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--color-text-muted)]"><Clock className="w-4 h-4 text-amber-400" /> {isOwner ? 'Under review' : 'In progress'}</span>
                <span className="text-white font-medium tabular-nums">{isOwner ? dbStats.submittedCount : dbStats.claimedCount}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--color-text-muted)]"><Zap className="w-4 h-4 text-accent" /> {isOwner ? 'Open' : 'Submitted'}</span>
                <span className="text-white font-medium tabular-nums">{isOwner ? dbStats.openCount : dbStats.submittedCount}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-accent"><BarChart3 className="w-4 h-4" /> Total</span>
                <span className="text-white font-medium tabular-nums">{dbStats.totalCount}</span>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
    </div>
  )
}
