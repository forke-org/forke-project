'use server'

import { auth, signIn, signOut } from '@/auth'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users, developers, subscribers } from '@/lib/db/schema'
import { eq, ilike, or } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { logAudit } from './actions/audit-actions'
import { readAttributionCookie, readSessionId } from './utils/attribution'
import { recordAuthEvent } from './actions/auth-events'

export async function signInWithGoogle(role?: 'developer' | 'owner', redirectTo?: string) {
  const cookieStore = await cookies()
  if (role) {
    cookieStore.set('forke_role', role, {
      path: '/',
      maxAge: 3600, // 1 hour
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete('forke_login_intent')
  } else {
    cookieStore.set('forke_login_intent', 'true', {
      path: '/',
      maxAge: 600, // 10 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete('forke_role')
  }
  
  await signIn('google', { redirectTo: redirectTo || '/dashboard' })
}

export async function signInWithGitHub(role?: 'developer' | 'owner', redirectTo?: string) {
  const cookieStore = await cookies()
  if (role) {
    cookieStore.set('forke_role', role, {
      path: '/',
      maxAge: 3600,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete('forke_login_intent')
  } else {
    cookieStore.set('forke_login_intent', 'true', {
      path: '/',
      maxAge: 600, // 10 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete('forke_role')
  }
  
  await signIn('github', { redirectTo: redirectTo || '/dashboard' })
}

export async function signOutAction() {
  await signOut()
}

export async function registerDeveloperWithCredentials(formData: any) {
  const { firstName, lastName, email, password, confirmPassword, username, receivePromotions } = formData

  if (!firstName || !lastName || !email || !password || !confirmPassword || !username) {
    return { success: false, error: 'All core fields including username are required.' }
  }

  // Username validation: max 30 chars, case sensitive, only "-" and "_" allowed besides alphanumeric
  if (username.length > 30) {
    return { success: false, error: 'Username must be 30 characters or less.' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, hyphens (-), and underscores (_).' }
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' }
  }

  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' }
  }

  try {
    // Independent existence checks — fetch concurrently, but keep the same
    // "email conflict reported before username conflict" priority as before.
    const [existingUserByEmail, existingUserByUsername] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.email, email) }),
      db.query.users.findFirst({ where: eq(users.username, username) }),
    ])

    if (existingUserByEmail) {
      return { success: false, error: 'A user with this email already exists.' }
    }

    if (existingUserByUsername) {
      return { success: false, error: 'This username is already taken. Please choose another.' }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const fullName = `${firstName} ${lastName}`

    // First-touch marketing attribution, tagged with the conversion role.
    const attribution = await readAttributionCookie()
    const sessionId = await readSessionId()
    const userAttribution = {
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      referrer: attribution.referrer,
      landingPage: attribution.landingPage,
      signupRole: 'developer' as const,
      sessionId, // joins this conversion back to the originating click in page_visits
    }

    const [newUser] = await db.insert(users).values({
      name: fullName,
      email: email,
      username: username,
      passwordHash: passwordHash,
      role: 'developer',
      isApproved: true, // Developers are instantly approved
      attribution: userAttribution,
    }).returning({ id: users.id })

    if (newUser) {
      // Auto-create a developer row with isGithubConnected = false
      await db.insert(developers).values({
        userId: newUser.id,
        isGithubConnected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Add to subscribers if receivePromotions is checked
      if (receivePromotions) {
        try {
          await db.insert(subscribers).values({
            email: email,
            source: attribution.source,
            attribution: {
              medium: attribution.medium,
              campaign: attribution.campaign,
              referrer: attribution.referrer,
              landingPage: attribution.landingPage,
            },
            createdAt: new Date()
          }).onConflictDoNothing()
        } catch (e) {
          console.error('Failed to add to subscribers upon registration:', e)
        }
      }

      // Log the developer signup
      await logAudit({
        category: 'user',
        action: 'developer.signup',
        target: username ? `@${username}` : fullName,
        actorName: fullName,
        actorId: newUser.id,
      })

      // Security log: hashed IP + country for the new account (abuse detection).
      await recordAuthEvent({
        userId: newUser.id,
        email,
        event: 'signup',
        provider: 'credentials',
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error registering developer:', error)
    return { success: false, error: 'Failed to create account. Please try again later.' }
  }
}

export async function checkUsernameAvailabilityAction(username: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized.' }
  }

  if (!username) {
    return { success: false, error: 'Username is required.' }
  }

  if (username.length > 30) {
    return { success: false, error: 'Username must be 30 characters or less.' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, hyphens (-), and underscores (_).' }
  }

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username)
    })

    if (existing && existing.id !== session.user.id) {
      return { success: true, isAvailable: false }
    }

    return { success: true, isAvailable: true }
  } catch (error) {
    console.error('Error checking username availability:', error)
    return { success: false, error: 'Failed to verify username.' }
  }
}

export async function completeOnboarding(formData: any) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized.' }
  }

  const { username, password } = formData

  if (!username) {
    return { success: false, error: 'Username is required.' }
  }

  if (username.length > 30) {
    return { success: false, error: 'Username must be 30 characters or less.' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, hyphens (-), and underscores (_).' }
  }

  try {
    const existingUserByUsername = await db.query.users.findFirst({
      where: eq(users.username, username)
    })

    if (existingUserByUsername && existingUserByUsername.id !== session.user.id) {
      return { success: false, error: 'This username is already taken. Please choose another.' }
    }

    const updates: Record<string, any> = {
      username: username,
    }

    if (password) {
      if (password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters long.' }
      }
      updates.passwordHash = await bcrypt.hash(password, 10)
    }

    await db.update(users).set(updates).where(eq(users.id, session.user.id))

    // Handle developer profile row creation/sync
    const existingProfile = await db.query.developers.findFirst({
      where: eq(developers.userId, session.user.id)
    })

    if (!existingProfile) {
      await db.insert(developers).values({
        userId: session.user.id,
        isGithubConnected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Log the developer signup/onboarding completion
    await logAudit({
      category: 'user',
      action: 'developer.signup',
      target: `@${username}`,
      actorName: session.user.name,
      actorId: session.user.id,
    })

    return { success: true }
  } catch (error) {
    console.error('Error during onboarding:', error)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
