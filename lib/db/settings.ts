import { db } from './index'
import { sql } from 'drizzle-orm'

export async function ensureSettingsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `)
  } catch (error) {
    console.error('Failed to ensure system_settings table exists:', error)
  }
}

export async function isWaitlistEnabled(): Promise<boolean> {
  await ensureSettingsTable()
  try {
    const result = await db.execute(sql`
      SELECT value FROM "system_settings" WHERE key = 'waitlist_enabled' LIMIT 1;
    `)
    if (result.length === 0) {
      // Default to true (waitlist is enabled by default)
      return true
    }
    return result[0].value === 'true'
  } catch (error) {
    console.error('Failed to query waitlist_enabled setting:', error)
    return true // Safe fallback
  }
}

export async function setWaitlistEnabled(enabled: boolean): Promise<void> {
  await ensureSettingsTable()
  const val = enabled ? 'true' : 'false'
  try {
    await db.execute(sql`
      INSERT INTO "system_settings" (key, value, updated_at)
      VALUES ('waitlist_enabled', ${val}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `)
  } catch (error) {
    console.error('Failed to update waitlist_enabled setting:', error)
  }
}

export async function getWaitlistBypassPassword(): Promise<string | null> {
  await ensureSettingsTable()
  try {
    const result = await db.execute(sql`
      SELECT value FROM "system_settings" WHERE key = 'waitlist_bypass_password' LIMIT 1;
    `)
    if (result.length === 0) {
      return null
    }
    return result[0].value as string
  } catch (error) {
    console.error('Failed to query waitlist_bypass_password setting:', error)
    return null
  }
}

export async function setWaitlistBypassPassword(password: string): Promise<void> {
  await ensureSettingsTable()
  try {
    await db.execute(sql`
      INSERT INTO "system_settings" (key, value, updated_at)
      VALUES ('waitlist_bypass_password', ${password}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `)
  } catch (error) {
    console.error('Failed to update waitlist_bypass_password setting:', error)
  }
}

export async function isActivityLogLive(): Promise<boolean> {
  await ensureSettingsTable()
  try {
    const result = await db.execute(sql`
      SELECT value FROM "system_settings" WHERE key = 'activity_log_live' LIMIT 1;
    `)
    if (result.length === 0) {
      // Default to true (live feed is active by default)
      return true
    }
    return result[0].value === 'true'
  } catch (error) {
    console.error('Failed to query activity_log_live setting:', error)
    return true // Safe fallback
  }
}

export async function setActivityLogLive(live: boolean): Promise<void> {
  await ensureSettingsTable()
  const val = live ? 'true' : 'false'
  try {
    await db.execute(sql`
      INSERT INTO "system_settings" (key, value, updated_at)
      VALUES ('activity_log_live', ${val}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `)
  } catch (error) {
    console.error('Failed to update activity_log_live setting:', error)
  }
}

