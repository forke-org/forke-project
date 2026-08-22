'use server'

import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, accounts, developers } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { createHash } from 'crypto'
import { encryptUrl } from '@/lib/utils/encrypt'
import { revalidatePath } from 'next/cache'
import { isR2Configured, uploadToR2, deleteFileByUrl } from '@/lib/r2'

// Runtime migration for the profile fields (mirrors ensureTelemetrySettingsColumns).
export async function ensureProfileColumns() {
  try {
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "headline" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "college" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website_url" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_url" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_avatar_url" text;`)
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_avatar_url" text;`)
  } catch (error) {
    console.error('Failed to add profile columns to users table:', error)
  }
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Uploads an avatar. The file is written under a SHA-256 content-hash name and
 * returns the plaintext path for client preview. It is not saved to the database
 * until the user clicks "Save changes".
 */
export async function uploadAvatar(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string') return { success: false, error: 'No file provided' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { success: false, error: 'Image must be PNG, JPEG, WebP or GIF' }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: 'Image must be under 5MB' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const hash = createHash('sha256').update(buffer).digest('hex')
    const ext = (extname(file.name) || '.png').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png'
    const fileName = `${hash}${ext}`

    if (isR2Configured()) {
      const url = await uploadToR2(buffer, `avatars/${fileName}`, file.type)
      return { success: true, url }
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(uploadsDir, { recursive: true })
    await writeFile(join(uploadsDir, fileName), buffer)

    const publicPath = `/uploads/avatars/${fileName}`
    return { success: true, url: publicPath }
  } catch (error) {
    console.error('Avatar upload failed:', error)
    return { success: false, error: 'Upload failed on server' }
  }
}

export interface ProfileUpdateInput {
  name?: string
  headline?: string
  bio?: string
  location?: string
  college?: string
  githubUrl?: string
  linkedinUrl?: string
  websiteUrl?: string
  avatarUrl?: string | null
}

export async function updateProfile(data: ProfileUpdateInput) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  await ensureProfileColumns()

  const clean = (v?: string) => {
    const t = v?.trim()
    return t ? t : null
  }

  const set: Record<string, unknown> = {
    headline: clean(data.headline),
    bio: clean(data.bio),
    location: clean(data.location),
    college: clean(data.college),
    githubUrl: clean(data.githubUrl),
    linkedinUrl: clean(data.linkedinUrl),
    websiteUrl: clean(data.websiteUrl),
  }
  // name is NOT NULL — only overwrite when a non-empty value is supplied.
  const name = data.name?.trim()
  if (name) set.name = name

  let oldAvatarUrl: string | null = null
  if (data.avatarUrl !== undefined) {
    set.image = data.avatarUrl ? encryptUrl(data.avatarUrl) : null

    // Get current profile image to delete from storage
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { image: true }
      })
      if (user?.image) {
        const { decryptUrl, isEncrypted } = await import('@/lib/utils/encrypt')
        oldAvatarUrl = isEncrypted(user.image) ? decryptUrl(user.image) : user.image
      }
    } catch (e) {
      console.error('Failed to query old avatar URL:', e)
    }
  }

  try {
    await db.update(users).set(set).where(eq(users.id, session.user.id))

    // If update succeeded and we have an old avatar to delete, delete it
    if (oldAvatarUrl && oldAvatarUrl !== data.avatarUrl) {
      const isUploadedAvatar = oldAvatarUrl.includes('/avatars/') || oldAvatarUrl.includes('/uploads/avatars/')
      if (isUploadedAvatar) {
        deleteFileByUrl(oldAvatarUrl).catch(err => console.error('Failed to cleanup old avatar file:', err))
      }
    }

    revalidatePath('/[username]', 'page')
    revalidatePath('/profile')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Profile update failed:', error)
    return { success: false, error: 'Could not save profile' }
  }
}

export async function getLinkedAvatars(): Promise<{ github: string | null; google: string | null }> {
  const session = await auth()
  if (!session?.user?.id) return { github: null, google: null }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        githubAvatarUrl: true,
        googleAvatarUrl: true,
      }
    })

    let githubAvatar = user?.githubAvatarUrl || null
    let googleAvatar = user?.googleAvatarUrl || null

    // If either is missing, resolve them via legacy/linked tables and cache them in users table
    if (!githubAvatar || !googleAvatar) {
      // Independent of each other — fetch concurrently.
      const [ghProfile, allAccounts] = await Promise.all([
        !githubAvatar
          ? db.query.developers.findFirst({ where: eq(developers.userId, session.user.id) })
          : Promise.resolve(null),
        db.select().from(accounts).where(eq(accounts.userId, session.user.id)),
      ])
      if (ghProfile?.avatarUrl) {
        githubAvatar = ghProfile.avatarUrl
      }

      // Check accounts table for providers if still missing
      for (const acct of allAccounts) {
        if (acct.provider === 'github' && !githubAvatar) {
          githubAvatar = `https://avatars.githubusercontent.com/u/${acct.providerAccountId}`
        }
        if (acct.provider === 'google' && !googleAvatar) {
          googleAvatar = `https://lh3.googleusercontent.com/a/${acct.providerAccountId}`
        }
      }

      // Update the users table to store these values permanently
      const updates: Record<string, string> = {}
      if (githubAvatar && githubAvatar !== user?.githubAvatarUrl) {
        updates.githubAvatarUrl = githubAvatar
      }
      if (googleAvatar && googleAvatar !== user?.googleAvatarUrl) {
        updates.googleAvatarUrl = googleAvatar
      }

      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, session.user.id))
      }
    }

    return { github: githubAvatar, google: googleAvatar }
  } catch (error) {
    console.error('Error fetching linked avatars:', error)
    return { github: null, google: null }
  }
}
