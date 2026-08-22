import { auth } from '@/auth'
import TopBar from '@/components/shared/TopBar'
import { db } from '@/lib/db'
import { users, owners, tasks, submissions } from '@/lib/db/schema'
import { eq, desc, sql, and } from 'drizzle-orm'
import {
  getLevelFromXp, getLevelTitle, getLevelProgress, getXpForNextLevel, calculateXpAward,
} from '@/lib/utils/xp'
import { redirect } from 'next/navigation'
import { resolveAvatarUrl } from '@/lib/utils/avatar'
import { ensureProfileColumns } from '@/lib/actions/profile-actions'
import ProfileEditor from '@/components/profile/ProfileEditor'
import { ShippedItem, AchievementItem, ProfileData } from '@/components/profile/PublicProfileView'

function getStreakMilestoneBonus(day: number): number {
  if (day === 30) return 150
  if (day === 14) return 100
  if (day === 7) return 50
  if (day === 5) return 30
  if (day === 2) return 15
  return 0
}

function toLocalDateString(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildHeatmap(activities: { date: Date; xp: number }[], currentStreak: number): { date: string; count: number }[] {
  const days = 371 // 53 weeks
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const counts = new Map<string, number>()
  
  for (const act of activities) {
    const key = toLocalDateString(new Date(act.date))
    counts.set(key, (counts.get(key) || 0) + act.xp + 10)
  }
  
  for (let s = 0; s < currentStreak; s++) {
    const d = new Date(today)
    d.setDate(today.getDate() - s)
    const key = toLocalDateString(d)
    
    const streakDayNum = currentStreak - s
    const milestoneBonus = getStreakMilestoneBonus(streakDayNum)
    
    const existing = counts.get(key) || 0
    if (existing > 0) {
      counts.set(key, existing + milestoneBonus)
    } else {
      counts.set(key, 10 + milestoneBonus)
    }
  }

  const out: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = toLocalDateString(d)
    out.push({ date: key, count: counts.get(key) || 0 })
  }
  return out
}

function buildAchievements(opts: { shipped: number; level: number; streak: number; earned: number }): AchievementItem[] {
  const { shipped, level, streak, earned } = opts
  return [
    { id: 'first', label: 'First Blood', desc: 'Shipped your first task', unlocked: shipped >= 1, icon: 'first' },
    { id: 'sprint', label: 'Sprinter', desc: 'Shipped 5+ tasks', unlocked: shipped >= 5, icon: 'sprint' },
    { id: 'untouchable', label: 'Untouchable', desc: '20+ approved ships', unlocked: shipped >= 20, icon: 'untouchable' },
    { id: 'streak', label: 'Streak God', desc: '30-day login streak', unlocked: streak >= 30, icon: 'streak' },
    { id: 'loot', label: 'Loot Goblin', desc: 'Earned ₹10,000+', unlocked: earned >= 10000, icon: 'loot' },
    { id: 'boss', label: 'Boss Mode', desc: 'Reached Level 15', unlocked: level >= 15, icon: 'boss' },
    { id: 'legend', label: 'Forke Legend', desc: 'Reached Level 25', unlocked: level >= 25, icon: 'legend' },
    { id: 'night', label: 'Stack Explorer', desc: 'Reached Level 5', unlocked: level >= 5, icon: 'night' },
  ]
}

export default async function ProfilePage() {
  const session = await auth()
  const sessionUser = session?.user as { id: string; name: string; role: 'developer' | 'owner'; email: string } | undefined

  if (!sessionUser) redirect('/signin')

  await ensureProfileColumns()

  const dbUser = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id) })
  if (!dbUser) redirect('/signin')

  // No username yet — send them to settings to finish setting up their handle.
  if (!dbUser.username) {
    redirect('/settings')
  }

  const isOwner = dbUser.role === 'owner'

  // ----- XP / level -----
  const xp = dbUser.xp || 0
  const level = getLevelFromXp(xp)
  const levelTitle = getLevelTitle(level)
  const xpProgress = getLevelProgress(xp)
  const nextLevelXp = getXpForNextLevel(level)
  const xpRemaining = nextLevelXp ? nextLevelXp - xp : 0

  // ----- shipped work + stats -----
  let shippedWork: ShippedItem[] = []
  let shipped = 0
  let avgRating: number | null = null
  let completionRate: number | null = null
  let earned = 0
  let shipActivities: { date: Date; xp: number }[] = []

  if (isOwner) {
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, budget: tasks.budget, tags: tasks.skillTags, date: tasks.createdAt })
      .from(tasks)
      .where(and(eq(tasks.clientId, dbUser.id), eq(tasks.status, 'approved')))
      .orderBy(desc(tasks.createdAt))
      .limit(30)
    shippedWork = rows.map((r) => ({ id: r.id, title: r.title, budget: Math.floor((r.budget || 0) / 100), tags: r.tags || [], rating: null, prUrl: null, date: r.date.toISOString() }))
    shipped = rows.length
    shipActivities = rows.map((r) => ({ date: r.date, xp: 100 }))
    earned = rows.reduce((s, r) => s + Math.floor((r.budget || 0) / 100), 0)
  } else {
    const [rows, totals] = await Promise.all([
      db
        .select({
          id: tasks.id, title: tasks.title, budget: tasks.budget, tags: tasks.skillTags,
          rating: submissions.rating, prUrl: submissions.githubLink, date: submissions.createdAt,
          taskCreatedAt: tasks.createdAt, deadline: tasks.deadline
        })
        .from(submissions)
        .innerJoin(tasks, eq(submissions.taskId, tasks.id))
        .where(and(eq(submissions.developerId, dbUser.id), eq(submissions.status, 'approved')))
        .orderBy(desc(submissions.createdAt))
        .limit(30),
      db
        .select({ total: sql<number>`count(*)::int`, approved: sql<number>`count(*) filter (where ${submissions.status} = 'approved')::int` })
        .from(submissions)
        .where(eq(submissions.developerId, dbUser.id)),
    ])
    shippedWork = rows.map((r) => ({ id: r.id, title: r.title, budget: Math.floor((r.budget || 0) / 100), tags: r.tags || [], rating: r.rating ?? null, prUrl: r.prUrl ?? null, date: r.date.toISOString() }))
    shipped = rows.length
    shipActivities = rows.map((r) => {
      const xpVal = calculateXpAward({
        budgetPaise: r.budget || 0,
        taskCreatedAt: r.taskCreatedAt,
        submittedAt: r.date,
        deadline: r.deadline,
        rating: r.rating,
        hadRevision: false
      })
      return {
        date: r.date,
        xp: xpVal
      }
    })
    earned = rows.reduce((s, r) => s + Math.floor((r.budget || 0) / 100), 0)

    const ratings = rows.map((r) => r.rating).filter((r): r is number => typeof r === 'number')
    avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

    const t = totals[0]
    completionRate = t && t.total > 0 ? Math.round((t.approved / t.total) * 100) : null
  }

  let ownerName: string | null = null
  if (isOwner) {
    const od = await db.query.owners.findFirst({ where: eq(owners.id, dbUser.id) })
    ownerName = od?.companyName || null
  }

  const data: ProfileData = {
    username: dbUser.username,
    name: ownerName || dbUser.name,
    headline: dbUser.headline ?? null,
    bio: dbUser.bio ?? null,
    location: dbUser.location ?? null,
    college: dbUser.college ?? null,
    avatarUrl: resolveAvatarUrl(dbUser.image),
    level,
    levelTitle,
    xp,
    xpProgress,
    xpRemaining,
    nextLevel: nextLevelXp ? level + 1 : null,
    currentStreak: dbUser.currentStreak || 0,
    joinedAt: dbUser.createdAt.toISOString(),
    githubUrl: dbUser.githubUrl ?? null,
    linkedinUrl: dbUser.linkedinUrl ?? null,
    websiteUrl: dbUser.websiteUrl ?? null,
    stats: { shipped, avgRating, completionRate },
    shippedWork,
    achievements: buildAchievements({ shipped, level, streak: dbUser.currentStreak || 0, earned }),
    heatmap: buildHeatmap(shipActivities, dbUser.currentStreak || 0),
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-white font-sans">
      <TopBar title="Profile" />
      {/* Mobile: page scrolls. Desktop: fixed height so the card pins and only the bento scrolls. */}
      <div className="flex-grow min-h-0 overflow-y-auto lg:overflow-hidden w-full px-4 md:px-6 lg:px-8 py-4 lg:py-5">
        <ProfileEditor data={data} />
      </div>
    </div>
  )
}
