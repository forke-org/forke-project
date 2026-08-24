import { AwsClient } from 'aws4fetch'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Checks if the Cloudflare R2 environment variables are fully configured.
 * If any of these are missing, the application falls back to local disk storage
 * under the public directory.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_ENDPOINT &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME &&
    process.env.CLOUDFLARE_R2_PUBLIC_URL
  )
}

export interface R2Credentials {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucketName: string
}

export function getR2Credentials(): R2Credentials {
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error('Cloudflare R2 is not fully configured. Missing environment variables.')
  }

  return { accessKeyId, secretAccessKey, endpoint, bucketName }
}

export function r2Client(creds: R2Credentials): AwsClient {
  return new AwsClient({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
}

// Same key sanitization used everywhere below so keys stay consistent across
// upload/presign/delete paths.
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9.-_/]/g, '_')
}

// Encode each path segment individually so slashes stay as folder separators.
export function objectUrl(endpoint: string, bucketName: string, key: string): string {
  const base = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${base}/${bucketName}/${encodedKey}`
}

export interface R2ObjectSummary {
  key: string
  size: number
  lastModified: string
}

/** Minimal extraction of <Contents> entries from an S3 ListObjectsV2 XML response. */
function parseListObjectsXmlFull(xml: string): R2ObjectSummary[] {
  const entries: R2ObjectSummary[] = []
  const contentsBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []
  for (const block of contentsBlocks) {
    const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/)
    const lastModifiedMatch = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)
    const sizeMatch = block.match(/<Size>([\s\S]*?)<\/Size>/)
    if (keyMatch && lastModifiedMatch) {
      entries.push({
        key: xmlUnescape(keyMatch[1]),
        lastModified: lastModifiedMatch[1],
        size: sizeMatch ? Number(sizeMatch[1]) : 0,
      })
    }
  }
  return entries
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function xmlEscapeShared(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Lists objects in the R2 bucket, optionally filtered by key prefix. */
export async function listObjects(prefix?: string): Promise<R2ObjectSummary[]> {
  const creds = getR2Credentials()
  const client = r2Client(creds)
  const base = creds.endpoint.endsWith('/') ? creds.endpoint.slice(0, -1) : creds.endpoint

  const params = new URLSearchParams({ 'list-type': '2' })
  if (prefix) params.set('prefix', prefix)

  const res = await client.fetch(`${base}/${creds.bucketName}?${params.toString()}`, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`R2 list failed: ${res.status} ${await res.text()}`)
  }
  return parseListObjectsXmlFull(await res.text())
}

/** Uploads raw bytes to an exact key (no sanitization — used for known/already-valid keys). */
export async function putObject(key: string, body: Buffer | string, contentType: string): Promise<void> {
  const creds = getR2Credentials()
  const client = r2Client(creds)
  const bodyBuffer = typeof body === 'string' ? Buffer.from(body, 'utf-8') : body
  const res = await client.fetch(objectUrl(creds.endpoint, creds.bucketName, key), {
    method: 'PUT',
    body: bodyBuffer as BodyInit,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bodyBuffer.length),
    },
  })
  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`)
  }
}

/** Deletes a single object by its exact key (no sanitization). */
export async function deleteObject(key: string): Promise<void> {
  const creds = getR2Credentials()
  const client = r2Client(creds)
  const res = await client.fetch(objectUrl(creds.endpoint, creds.bucketName, key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status} ${await res.text()}`)
  }
}

/** Batch-deletes objects by exact key (no sanitization). No-op on an empty list. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const creds = getR2Credentials()
  const client = r2Client(creds)
  const base = creds.endpoint.endsWith('/') ? creds.endpoint.slice(0, -1) : creds.endpoint

  const body =
    '<Delete><Quiet>true</Quiet>' +
    keys.map((k) => `<Object><Key>${xmlEscapeShared(k)}</Key></Object>`).join('') +
    '</Delete>'

  const res = await client.fetch(`${base}/${creds.bucketName}?delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body,
  })
  if (!res.ok) {
    throw new Error(`R2 batch delete failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Uploads a file buffer directly to Cloudflare R2 bucket.
 *
 * @param fileBuffer The buffer content of the file.
 * @param key The destination path/key in the bucket (e.g., 'blogs/my-image.jpg').
 * @param contentType The MIME type of the file.
 * @returns The fully qualified public URL to access the uploaded file.
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const creds = getR2Credentials()
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!publicUrl) {
    throw new Error('Cloudflare R2 is not fully configured. Missing environment variables.')
  }

  const cleanKey = sanitizeKey(key)
  const client = r2Client(creds)

  const res = await client.fetch(objectUrl(creds.endpoint, creds.bucketName, cleanKey), {
    method: 'PUT',
    body: fileBuffer as BodyInit,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`)
  }

  const basePublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl
  return `${basePublicUrl}/${cleanKey}`
}

/**
 * Generate a short-lived presigned PUT URL so the browser can upload a file
 * DIRECTLY to R2, bypassing the server entirely. This sidesteps Vercel's
 * ~4.5 MB serverless request-body limit (which a multi-MB GIF blows past).
 *
 * The signed URL is bound to the exact key and Content-Type, so the client
 * must PUT with the same `Content-Type` header it declared here.
 *
 * @param key         Destination key in the bucket (e.g. 'blogs/uuid.gif').
 * @param contentType MIME type the browser will send (must match on PUT).
 * @param expiresIn   URL lifetime in seconds (default 5 minutes).
 * @returns `{ uploadUrl, publicUrl }` — PUT to `uploadUrl`, serve `publicUrl`.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const creds = getR2Credentials()
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!publicUrl) {
    throw new Error('Cloudflare R2 is not fully configured. Missing environment variables.')
  }

  const cleanKey = sanitizeKey(key)
  const client = r2Client(creds)

  const urlToSign = new URL(objectUrl(creds.endpoint, creds.bucketName, cleanKey))
  urlToSign.searchParams.set('X-Amz-Expires', String(expiresIn))

  const signedRequest = await client.sign(urlToSign.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    aws: { signQuery: true },
  })

  const basePublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl
  return { uploadUrl: signedRequest.url, publicUrl: `${basePublicUrl}/${cleanKey}` }
}

/**
 * Deletes a file, either from Cloudflare R2 if it is an R2 URL,
 * or from the local public directory.
 *
 * @param url The fully qualified URL or relative local path of the file.
 */
export async function deleteFileByUrl(url: string): Promise<boolean> {
  if (!url) return false

  // 1. Check if it's an R2 URL
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
  const isR2Url = isR2Configured() && (
    url.startsWith(publicUrl) ||
    url.includes('.r2.dev/') ||
    url.includes('.r2.cloudflarestorage.com/')
  )

  if (isR2Url) {
    try {
      // Extract key from the URL. The key is the path after the hostname/public URL
      // e.g. https://pub-xxxx.r2.dev/blogs/file.png -> blogs/file.png
      let key = ''
      if (publicUrl && url.startsWith(publicUrl)) {
        key = url.slice(publicUrl.length)
      } else {
        // Fallback generic parser: get path part from URL
        const parsedUrl = new URL(url)
        key = parsedUrl.pathname
      }

      // Strip leading slash if any
      if (key.startsWith('/')) {
        key = key.slice(1)
      }
      key = decodeURIComponent(key)

      await deleteObject(key)
      return true
    } catch (e: any) {
      console.error('Failed to delete file from R2:', e.message || e)
      return false
    }
  }

  // 2. Otherwise delete from local filesystem
  try {
    // Local URL is e.g. /uploads/blogs/filename.png or /avatars/filename.png
    // Strip leading slash to resolve from process.cwd() + "/public"
    const cleanPath = url.startsWith('/') ? url.slice(1) : url
    const localPath = path.resolve(process.cwd(), 'public', cleanPath)
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath)
      return true
    }
  } catch (e: any) {
    console.error('Failed to delete local file:', e.message || e)
  }

  return false
}

/**
 * Generate a short-lived presigned GET URL so that the user can download
 * the backup file securely.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 43200 // 12 hours in seconds
): Promise<string> {
  const creds = getR2Credentials()
  const cleanKey = sanitizeKey(key)
  const client = r2Client(creds)

  const urlToSign = new URL(objectUrl(creds.endpoint, creds.bucketName, cleanKey))
  urlToSign.searchParams.set('X-Amz-Expires', String(expiresIn))

  const signedRequest = await client.sign(urlToSign.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  })

  return signedRequest.url
}

/**
 * Lists all objects with prefix 'backups/' and deletes any that are
 * older than maxAgeMs (default 12 hours).
 */
export async function cleanupExpiredBackups(
  maxAgeMs = 12 * 60 * 60 * 1000 // 12 hours
): Promise<string[]> {
  const entries = await listObjects('backups/')

  const now = Date.now()
  const objectsToDelete = entries.filter((obj) => now - new Date(obj.lastModified).getTime() > maxAgeMs)

  if (objectsToDelete.length === 0) {
    return []
  }

  await deleteObjects(objectsToDelete.map((obj) => obj.key))

  return objectsToDelete.map((obj) => obj.key)
}
