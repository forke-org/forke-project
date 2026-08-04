'use server'

import { db } from '@/lib/db'
import { messages, users } from '@/lib/db/schema'
import { eq, and, or, asc, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { encryptUrl, decryptUrl } from '@/lib/utils/encrypt'
import { isR2Configured, uploadToR2 } from '@/lib/r2'

export async function ensureMessagesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "receiver_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "is_received" boolean DEFAULT false NOT NULL,
        "is_seen" boolean DEFAULT false NOT NULL,
        "file_url" text,
        "file_name" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `)
  } catch (error) {
    console.error('Failed to ensure messages table exists:', error)
  }
}

export async function uploadChatFile(formData: FormData) {
  try {
    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}-${cleanName}`

    if (isR2Configured()) {
      const url = await uploadToR2(buffer, `chats/${fileName}`, file.type)
      const encryptedUrl = encryptUrl(url)
      return { success: true, fileUrl: encryptedUrl, fileName: file.name }
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/${fileName}`
    const encryptedUrl = encryptUrl(fileUrl)
    return { success: true, fileUrl: encryptedUrl, fileName: file.name }
  } catch (error) {
    console.error('File upload failed:', error)
    return { success: false, error: 'File upload failed on server' }
  }
}



export async function getMessagesBetweenUsers(userId1: string, userId2: string) {
  await ensureMessagesTable()
  try {
    // 1. Update userId1's lastActiveAt to now
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId1))

    // 2. Mark all messages sent to userId1 (receiver) as received (since userId1 is online)
    await db
      .update(messages)
      .set({ isReceived: true })
      .where(
        and(
          eq(messages.receiverId, userId1),
          eq(messages.isReceived, false)
        )
      )

    // 3. Mark messages sent by userId2 to userId1 as read/seen (since userId1 is viewing chat with userId2)
    await db
      .update(messages)
      .set({ isReceived: true, isSeen: true })
      .where(
        and(
          eq(messages.senderId, userId2),
          eq(messages.receiverId, userId1),
          or(eq(messages.isReceived, false), eq(messages.isSeen, false))
        )
      )

    // 4. Fetch the message thread
    const list = await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(asc(messages.createdAt))

    // 5. Fetch userId2's lastActiveAt status
    const [user2] = await db
      .select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId2))

    const isOnline = user2?.lastActiveAt
      ? (new Date().getTime() - new Date(user2.lastActiveAt).getTime()) < 12000 // online if active within last 12 seconds
      : false

    // Decrypt fileUrl for each message before returning to the client
    const decryptedList = list.map(msg => ({
      ...msg,
      fileUrl: msg.fileUrl ? (decryptUrl(msg.fileUrl) ?? msg.fileUrl) : null,
    }))

    return { success: true, messages: decryptedList, isOnline }
  } catch (e) {
    console.error('Failed to get messages:', e)
    return { success: false, messages: [], isOnline: false, error: 'Failed to retrieve conversation history.' }
  }
}

export async function sendMessageAction(
  senderId: string,
  receiverId: string,
  content: string,
  fileUrl?: string,
  fileName?: string
) {
  await ensureMessagesTable()
  if ((!content || !content.trim()) && !fileUrl) {
    return { success: false, error: 'Message content cannot be empty.' }
  }
  try {
    // Check if receiver is online to mark as received immediately
    const [receiver] = await db
      .select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, receiverId))

    const isReceiverOnline = receiver?.lastActiveAt
      ? (new Date().getTime() - new Date(receiver.lastActiveAt).getTime()) < 12000
      : false

    const [insertedMessage] = await db
      .insert(messages)
      .values({
        senderId,
        receiverId,
        content: content ? content.trim() : (fileName || 'Sent a file'),
        isReceived: isReceiverOnline,
        isSeen: false,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
      })
      .returning()

    revalidatePath('/messages')
    return { success: true, message: insertedMessage }
  } catch (e) {
    console.error('Failed to send message:', e)
    return { success: false, error: 'Database error. Failed to dispatch message.' }
  }
}
