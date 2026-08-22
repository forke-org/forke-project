import { db } from '@/lib/db'
import { users, owners, tasks, submissions } from '@/lib/db/schema'
import { eq, desc, sql, and } from 'drizzle-orm'
import crypto from 'crypto'
import {
  getLevelFromXp, getLevelTitle, getLevelProgress, getXpForNextLevel, calculateXpAward,
} from '@/lib/utils/xp'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { auth } from '@/auth'
import { resolveAvatarUrl } from '@/lib/utils/avatar'
import { ensureProfileColumns } from '@/lib/actions/profile-actions'
import PublicProfileView, { ProfileData, ShippedItem, AchievementItem } from '@/components/profile/PublicProfileView'
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'

const RESERVED_KEYWORDS = [
  'admin', 'api', 'checkout', 'privacy', 'register', 'signin', 'terms', 'waitlist',
  'auth-error', 'profile', 'dashboard', 'tasks', 'submissions', 'earnings',
  'messages', 'settings', 'support', 'developers', 'onboarding', 'post-task', 'notifications',
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  if (RESERVED_KEYWORDS.includes(username.toLowerCase())) return {}

  const dbUser = await db.query.users.findFirst({ where: eq(users.username, username) })
  if (!dbUser) return {}

  const level = getLevelFromXp(dbUser.xp || 0)
  const title = `${dbUser.name} (@${dbUser.username})`

  // Social/SEO descriptions should be ~110-160 chars. Bios can be long (2500
  // char limit), so trim to a level-aware budget, cut on a word boundary, and
  // append the "· Level N Title" suffix without blowing past ~160 chars.
  const levelSuffix = ` · Level ${level} ${getLevelTitle(level)}`
  const intro = (dbUser.headline || dbUser.bio || 'Building real, verified work on Forke.')
    .replace(/\s+/g, ' ')
    .trim()
  const maxIntro = Math.max(40, 158 - levelSuffix.length)
  const trimmedIntro = intro.length > maxIntro
    ? `${intro.slice(0, maxIntro).replace(/\s+\S*$/, '')}…`
    : intro
  const description = `${trimmedIntro}${levelSuffix}`

  // Cache-buster: a short hash of everything the OG image renders. When the user
  // changes their avatar/name/headline/level, this version changes, so the
  // og:image URL changes and external scrapers (LinkedIn, Twitter, etc.) re-fetch
  // instead of serving their cached copy.
  const ogVersion = crypto
    .createHash('sha1')
    .update(`${dbUser.name}|${dbUser.image || ''}|${dbUser.headline || ''}|${dbUser.bio || ''}|${dbUser.xp || 0}`)
    .digest('hex')
    .slice(0, 10)
  const ogImageUrl = `/${dbUser.username}/opengraph-image?v=${ogVersion}`

  return {
    title,
    description,
    alternates: { canonical: `/${dbUser.username}` },
    openGraph: {
      title,
      description,
      type: 'profile',
      username: dbUser.username || undefined,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
  }
}

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

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  if (RESERVED_KEYWORDS.includes(username.toLowerCase())) notFound()

  await ensureProfileColumns()

  const dbUser = await db.query.users.findFirst({ where: eq(users.username, username) })
  if (!dbUser) notFound()

  const session = await auth()
  const isOwnProfile = !!session?.user && session.user.id === dbUser.id
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
    username: dbUser.username || username,
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
    <div className="min-h-screen bg-[#060608] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-[#060608] to-[#060608] text-white font-sans flex flex-col antialiased">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 min-[1920px]:max-w-[1920px]">
        <PublicProfileView data={data} isOwnProfile={isOwnProfile} contained={false} />
      </main>

      <Footer />
    </div>
  )
}
