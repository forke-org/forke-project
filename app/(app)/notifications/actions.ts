'use server'

import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/**
 * Ensures the notifications table exists (creates it if missing via raw SQL).
 * Useful until a proper migration is run.
 */
export async function ensureNotificationsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "link" text,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `)
  } catch {
    // Table may already exist — safe to ignore
  }
}

/** Fetch all notifications for a user, newest first */
export async function getNotifications(userId: string) {
  await ensureNotificationsTable()
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return { success: true, notifications: list }
  } catch (e) {
    console.error('Failed to fetch notifications:', e)
    return { success: false, notifications: [] }
  }
}

/** Count unread notifications */
export async function getUnreadCount(userId: string) {
  await ensureNotificationsTable()
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    return { success: true, count: row?.count ?? 0 }
  } catch {
    return { success: false, count: 0 }
  }
}

/** Mark a single notification as read */
export async function markNotificationRead(notificationId: string, userId: string) {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e) {
    console.error('Failed to mark notification read:', e)
    return { success: false }
  }
}

/** Mark ALL notifications as read for a user */
export async function markAllNotificationsRead(userId: string) {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId))
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e) {
    console.error('Failed to mark all notifications read:', e)
    return { success: false }
  }
}

/** Delete a single notification */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e) {
    console.error('Failed to delete notification:', e)
    return { success: false }
  }
}

/** Delete ALL notifications for a user */
export async function deleteAllNotifications(userId: string) {
  try {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e) {
    console.error('Failed to delete all notifications:', e)
    return { success: false }
  }
}

/** Create a notification (called from other server actions) */
export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}) {
  await ensureNotificationsTable()
  try {
    await db.insert(notifications).values({ userId, type, title, body, link: link ?? null })
    return { success: true }
  } catch (e) {
    console.error('Failed to create notification:', e)
    return { success: false }
  }
}
