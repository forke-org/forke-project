import { auth } from '@/auth'
import TopBar from '@/components/shared/TopBar'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'
import { getTasksPendingReview, getTasksByClaimant } from '@/lib/db/queries/tasks'
import ReviewCard from '@/components/tasks/ReviewCard'
import ActiveTaskCard from '@/components/tasks/ActiveTaskCard'
import {
  CheckCircle2,
  Clock,
  Plus,
  Activity,
  Coins,
  Wallet,
  Flame,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { tasks, submissions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

import { getLevelFromXp, getLevelTitle } from '@/lib/utils/xp'

const OWNER_LEVEL_TITLES: Record<number, string> = {
  1: 'Initiator',
  2: 'Vanguard',
  3: 'Patron',
  4: 'Pioneer',
  5: 'Director',
  6: 'Strategist',
  7: 'Founder',
  8: 'Venture Partner',
  9: 'Titan',
  10: 'Syndicate',
  11: 'Sovereign',
  12: 'Sovereign',
  13: 'Sovereign',
  14: 'Sovereign',
  15: 'Sovereign',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const session = await auth()
  const user = session?.user as
    | { id: string; name: string; role: 'developer' | 'owner'; xp?: number; currentStreak?: number }
    | undefined
  const firstName = user?.name?.split(' ')[0] || 'there'

  const pendingReviews = user?.role === 'owner' ? await getTasksPendingReview(user.id) : []
  const activeTasks = user?.role === 'developer' ? await getTasksByClaimant(user.id) : []

  // Dynamic live statistics
  const ownerStats = { activeCount: 0, completedCount: 0, totalEscrow: 0, totalSpent: 0 }
  const devStats = { activeCount: 0, completedCount: 0, totalEscrow: 0, totalEarned: 0 }
  let avgTurnaroundHours: number | null = null

  try {
    if (user?.role === 'owner') {
      const [statsResult, ownerTurnaround] = await Promise.all([
        db
          .select({
            status: tasks.status,
            count: sql<number>`count(*)::int`,
            sumBudget: sql<number>`sum(${tasks.budget})::int`,
          })
          .from(tasks)
          .where(eq(tasks.clientId, user.id))
          .groupBy(tasks.status),
        db
          .select({
            avgHours: sql<number>`avg(extract(epoch from (${submissions.createdAt} - ${tasks.createdAt})) / 3600)::float`,
          })
          .from(tasks)
          .innerJoin(submissions, eq(submissions.taskId, tasks.id))
          .where(eq(tasks.clientId, user.id)),
      ])

      for (const row of statsResult) {
        if (row.status === 'approved') {
          ownerStats.completedCount += row.count
          ownerStats.totalSpent += row.sumBudget ? Math.floor(row.sumBudget / 100) : 0
        } else {
          ownerStats.activeCount += row.count
          ownerStats.totalEscrow += row.sumBudget ? Math.floor(row.sumBudget / 100) : 0
        }
      }
      avgTurnaroundHours = ownerTurnaround[0]?.avgHours ?? null
    } else if (user?.role === 'developer') {
      const [statsResult, devTurnaround] = await Promise.all([
        db
          .select({
            status: tasks.status,
            count: sql<number>`count(*)::int`,
            sumBudget: sql<number>`sum(${tasks.budget})::int`,
          })
          .from(tasks)
          .where(eq(tasks.claimantId, user.id))
          .groupBy(tasks.status),
        db
          .select({
            avgHours: sql<number>`avg(extract(epoch from (${submissions.createdAt} - ${tasks.createdAt})) / 3600)::float`,
          })
          .from(tasks)
          .innerJoin(submissions, eq(submissions.taskId, tasks.id))
          .where(eq(submissions.developerId, user.id)),
      ])

      for (const row of statsResult) {
        if (row.status === 'approved') {
          devStats.completedCount += row.count
          devStats.totalEarned += row.sumBudget ? Math.floor(row.sumBudget / 100) : 0
        } else {
          devStats.activeCount += row.count
          devStats.totalEscrow += row.sumBudget ? Math.floor(row.sumBudget / 100) : 0
        }
      }
      avgTurnaroundHours = devTurnaround[0]?.avgHours ?? null
    }
  } catch (e) {
    console.error('Failed to load dashboard dynamic stats:', e)
  }

  const isOwner = user?.role === 'owner'
  const stats = isOwner ? ownerStats : devStats
  const financialTotal = isOwner ? ownerStats.totalSpent : devStats.totalEarned
  const userLevel = getLevelFromXp(user?.xp || 0)
  const userLevelTitle = isOwner ? OWNER_LEVEL_TITLES[userLevel] || 'Owner' : getLevelTitle(userLevel)
  const streak = user?.currentStreak || 0

  const statCards = [
    {
      label: isOwner ? 'Active tasks' : 'Active tasks',
      value: stats.activeCount.toLocaleString(),
      hint: 'In progress',
      icon: Activity,
    },
    {
      label: 'Completed',
      value: stats.completedCount.toLocaleString(),
      hint: 'Shipped & approved',
      icon: CheckCircle2,
    },
    {
      label: isOwner ? 'In escrow' : 'Claimed value',
      value: `₹${stats.totalEscrow.toLocaleString()}`,
      hint: isOwner ? 'Held against active work' : 'Across active claims',
      icon: Coins,
    },
    {
      label: isOwner ? 'Total spent' : 'Total earned',
      value: `₹${financialTotal.toLocaleString()}`,
      hint: isOwner ? 'Lifetime payouts' : 'Lifetime payouts',
      icon: Wallet,
    },
  ]

  return (
    <div className="flex flex-col h-full font-sans bg-transparent text-[var(--color-text-primary)]">
      <TopBar title="Overview" />

      <div className="flex-grow overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-6 md:py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                {greeting()}, {firstName}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {isOwner
                  ? 'Post scoped tasks, review submissions, and release escrow when work ships.'
                  : 'Claim micro-tasks, ship real code, and build verified proof of work.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <>
                  <Link
                    href="/post-task"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm ui-btn-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Post task
                  </Link>
                  <Link
                    href="/tasks"
                    className="inline-flex items-center h-9 px-4 rounded-lg text-sm ui-btn-secondary transition-colors"
                  >
                    Browse tasks
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/tasks"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm ui-btn-primary transition-colors"
                  >
                    Browse tasks
                  </Link>
                  <Link
                    href="/earnings"
                    className="inline-flex items-center h-9 px-4 rounded-lg text-sm ui-btn-secondary transition-colors"
                  >
                    Earnings
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">{card.label}</span>
                    <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="ui-kpi mt-3">{card.value}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{card.hint}</p>
                </div>
              )
            })}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: primary list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">
                    {isOwner ? 'Pending reviews' : 'Active tasks'}
                  </h3>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/[0.06] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
                    {isOwner ? pendingReviews.length : activeTasks.length}
                  </span>
                </div>
                <Link
                  href={isOwner ? '/submissions' : '/tasks'}
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
                >
                  {isOwner ? 'All submissions' : 'Browse feed'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {isOwner ? (
                pendingReviews.length > 0 ? (
                  <div className="space-y-4">
                    {pendingReviews.map((item) => (
                      <ReviewCard
                        key={item.task.id}
                        task={item.task}
                        submission={item.submission}
                        claimantName={item.claimantName}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    title="No pending reviews"
                    body="When developers submit work on your tasks, it shows up here for review."
                    cta={{ href: '/post-task', label: 'Post a task' }}
                  />
                )
              ) : activeTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTasks.map((item) => (
                    <ActiveTaskCard key={item.task.id} task={item.task} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Activity className="w-5 h-5" />}
                  title="No active tasks"
                  body="You haven't claimed any tasks yet. Head to the feed to find your next one."
                  cta={{ href: '/tasks', label: 'Browse tasks' }}
                />
              )}
            </div>

            {/* Right: stats panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <h4 className="text-sm font-medium text-white">
                    {isOwner ? 'Account' : 'Your progress'}
                  </h4>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  <StatRow
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Level"
                    value={`${userLevel} · ${userLevelTitle}`}
                  />
                  <StatRow
                    icon={<Flame className="w-4 h-4" />}
                    label={isOwner ? 'Review streak' : 'Day streak'}
                    value={streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : 'None yet'}
                    accent={streak > 0}
                  />
                  <StatRow
                    icon={<Clock className="w-4 h-4" />}
                    label={isOwner ? 'Avg review time' : 'Avg turnaround'}
                    value={
                      avgTurnaroundHours
                        ? `${Math.max(1, Math.round(avgTurnaroundHours))} hrs`
                        : 'No data'
                    }
                  />
                  <StatRow
                    icon={<Activity className="w-4 h-4" />}
                    label="Active now"
                    value={`${stats.activeCount}`}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4">
                <h4 className="text-sm font-medium text-white">
                  {isOwner ? 'Need work done?' : 'Earn your next payout'}
                </h4>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                  {isOwner
                    ? 'Scope a task, set a budget, and let vetted developers ship it for you.'
                    : 'Browse open tasks that match your level and skills, then claim one to start.'}
                </p>
                <Link
                  href={isOwner ? '/post-task' : '/tasks'}
                  className="inline-flex items-center gap-1.5 mt-3 h-8 px-3 rounded-lg text-[13px] ui-btn-secondary transition-colors"
                >
                  {isOwner ? (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Post a task
                    </>
                  ) : (
                    <>
                      Browse tasks <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Link>
              </div>
            </div>
          </div>

          {!isOwner && (
            <div className="border-t border-[var(--color-border)] pt-6">
              <SandboxWorkspace presetRole="developer" embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-muted)]">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        {label}
      </span>
      <span
        className={`text-[13px] font-medium tabular-nums ${
          accent ? 'text-accent' : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode
  title: string
  body: string
  cta: { href: string; label: string }
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white/[0.01] px-6 py-12 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-full border border-[var(--color-border)] bg-white/[0.02] flex items-center justify-center text-[var(--color-text-muted)]">
        {icon}
      </div>
      <p className="text-sm font-medium text-white mt-4">{title}</p>
      <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5 max-w-xs leading-relaxed">
        {body}
      </p>
      <Link
        href={cta.href}
        className="inline-flex items-center h-8 px-3.5 rounded-lg text-[13px] ui-btn-secondary transition-colors mt-4"
      >
        {cta.label}
      </Link>
    </div>
  )
}
