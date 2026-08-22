'use server'

import fs from 'fs'
import path from 'path'
import { isAdminAuthenticated, getCurrentAdmin } from '../admin-actions'
import { logAudit } from './audit-actions'
import { isR2Configured, uploadToR2, listObjects, putObject, deleteObject, deleteObjects } from '../r2'
import { revalidatePath } from 'next/cache'

// Helper to check if admin is authenticated
async function ensureAdmin() {
  if (!await isAdminAuthenticated()) {
    throw new Error('Unauthorized')
  }
}

// Helper to check if current admin has super_admin role
async function ensureSuperAdmin() {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  if (!admin || admin.role !== 'super_admin') {
    throw new Error('Forbidden: Only Super Admins have modification access.')
  }
  return admin
}

/**
 * Retrieves the current R2 config from process.env, masking secret fields.
 */
export async function getR2ConfigAction() {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  
  return {
    success: true,
    isAdminSuper: admin?.role === 'super_admin',
    config: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY 
        ? `${process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY.slice(0, 4)}••••••••${process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY.slice(-4)}`
        : '',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
      apiToken: process.env.CLOUDFLARE_API_TOKEN
        ? `${process.env.CLOUDFLARE_API_TOKEN.slice(0, 4)}••••••••${process.env.CLOUDFLARE_API_TOKEN.slice(-4)}`
        : '',
      isConfigured: isR2Configured()
    }
  }
}

/**
 * Saves R2 settings to process.env and updates .env.local
 */
export async function saveR2ConfigAction(data: {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucketName: string
  publicUrl: string
  apiToken: string
}) {
  const admin = await ensureSuperAdmin()

  try {
    // 1. Update in-memory variables
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = data.accessKeyId.trim()
    
    if (!data.secretAccessKey.includes('••••••••')) {
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = data.secretAccessKey.trim()
    }
    
    process.env.CLOUDFLARE_R2_ENDPOINT = data.endpoint.trim()
    process.env.CLOUDFLARE_R2_BUCKET_NAME = data.bucketName.trim()
    process.env.CLOUDFLARE_R2_PUBLIC_URL = data.publicUrl.trim()

    if (!data.apiToken.includes('••••••••')) {
      process.env.CLOUDFLARE_API_TOKEN = data.apiToken.trim()
    }

    // 2. Read, modify, and write .env.local
    const envPath = path.resolve(process.cwd(), '.env.local')
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    const envLines = envContent.split('\n')
    const r2Keys = [
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
      'CLOUDFLARE_R2_ENDPOINT',
      'CLOUDFLARE_R2_BUCKET_NAME',
      'CLOUDFLARE_R2_PUBLIC_URL',
      'CLOUDFLARE_API_TOKEN'
    ]

    let filteredLines = envLines.filter(line => {
      const trimmed = line.trim()
      if (!trimmed) return true
      const parts = trimmed.split('=')
      return !r2Keys.includes(parts[0].trim())
    })

    while (filteredLines.length > 0 && !filteredLines[filteredLines.length - 1].trim()) {
      filteredLines.pop()
    }

    filteredLines.push('')
    filteredLines.push('# Cloudflare R2 Storage Configurations')
    filteredLines.push(`CLOUDFLARE_R2_ACCESS_KEY_ID="${process.env.CLOUDFLARE_R2_ACCESS_KEY_ID}"`)
    filteredLines.push(`CLOUDFLARE_R2_SECRET_ACCESS_KEY="${process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY}"`)
    filteredLines.push(`CLOUDFLARE_R2_ENDPOINT="${process.env.CLOUDFLARE_R2_ENDPOINT}"`)
    filteredLines.push(`CLOUDFLARE_R2_BUCKET_NAME="${process.env.CLOUDFLARE_R2_BUCKET_NAME}"`)
    filteredLines.push(`CLOUDFLARE_R2_PUBLIC_URL="${process.env.CLOUDFLARE_R2_PUBLIC_URL}"`)
    filteredLines.push(`CLOUDFLARE_API_TOKEN="${process.env.CLOUDFLARE_API_TOKEN || ''}"`)
    filteredLines.push('')

    fs.writeFileSync(envPath, filteredLines.join('\n'), 'utf-8')

    await logAudit({
      category: 'system',
      action: 'r2.config_updated',
      target: `Bucket: ${data.bucketName}`,
      actorId: admin.id,
      actorName: admin.name
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to save R2 config:', error)
    return { success: false, error: error.message || 'Failed to save configuration.' }
  }
}

export interface BucketObject {
  key: string
  size: number
  lastModified: string
  url: string
  isLocal: boolean
  contentType?: string
}

/**
 * Lists objects in R2 or local uploads folder.
 */
export async function listBucketObjectsAction(): Promise<{ success: boolean; objects?: BucketObject[]; error?: string; mode?: 'r2' | 'local' }> {
  await ensureAdmin()

  if (isR2Configured()) {
    try {
      const listResult = await listObjects()

      const basePublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!.endsWith('/')
        ? process.env.CLOUDFLARE_R2_PUBLIC_URL!.slice(0, -1)
        : process.env.CLOUDFLARE_R2_PUBLIC_URL!

      const objects: BucketObject[] = listResult.map(o => {
        const ext = o.key.split('.').pop()?.toLowerCase() || ''
        let contentType = 'application/octet-stream'
        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
          contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
        } else if (['mp4', 'webm'].includes(ext)) {
          contentType = `video/${ext}`
        } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
          contentType = `audio/${ext === 'mp3' ? 'mpeg' : ext}`
        } else if (ext === 'pdf') {
          contentType = 'application/pdf'
        } else if (ext === 'json') {
          contentType = 'application/json'
        } else if (['txt', 'md', 'html', 'css', 'js'].includes(ext)) {
          contentType = `text/${ext === 'txt' ? 'plain' : ext === 'md' ? 'markdown' : ext}`
        }

        return {
          key: o.key,
          size: o.size,
          lastModified: o.lastModified || new Date().toISOString(),
          url: `${basePublicUrl}/${o.key}`,
          isLocal: false,
          contentType: contentType
        }
      })

      return { success: true, objects, mode: 'r2' }
    } catch (error: any) {
      console.error('Failed to list R2 objects:', error)
      return { success: false, error: `R2 API Error: ${error.message || error}`, mode: 'r2' }
    }
  } else {
    try {
      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads')
      const objects: BucketObject[] = []

      if (fs.existsSync(uploadsDir)) {
        const scanDir = (dirPath: string) => {
          const files = fs.readdirSync(dirPath)
          for (const file of files) {
            const fullPath = path.join(dirPath, file)
            const stat = fs.statSync(fullPath)
            if (stat.isDirectory()) {
              scanDir(fullPath)
            } else if (stat.isFile() && !file.startsWith('.')) {
              const relativeKey = path.relative(uploadsDir, fullPath).replace(/\\/g, '/')
              const ext = file.split('.').pop()?.toLowerCase() || ''
              let contentType = 'application/octet-stream'
              if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
                contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
              } else if (['txt', 'md'].includes(ext)) {
                contentType = `text/${ext === 'txt' ? 'plain' : 'markdown'}`
              }

              objects.push({
                key: `uploads/${relativeKey}`,
                size: stat.size,
                lastModified: stat.mtime.toISOString(),
                url: `/uploads/${relativeKey}`,
                isLocal: true,
                contentType: contentType
              })
            }
          }
        }
        scanDir(uploadsDir)
      }

      return { success: true, objects, mode: 'local' }
    } catch (error: any) {
      console.error('Failed to scan local uploads:', error)
      return { success: false, error: `Local filesystem scan failed: ${error.message || error}`, mode: 'local' }
    }
  }
}

/**
 * Uploads a file to R2 or local directory.
 */
export async function uploadBucketObjectAction(formData: FormData) {
  const admin = await ensureSuperAdmin()

  const file = formData.get('file') as File
  const customPrefix = formData.get('prefix') as string || ''
  
  if (!file) {
    return { success: false, error: 'No file provided in form data.' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    
    let key = ''
    if (customPrefix) {
      const cleanPrefix = customPrefix.endsWith('/') ? customPrefix : `${customPrefix}/`
      key = `${cleanPrefix}${file.name.replace(/\s+/g, '_')}`
    } else {
      let prefix = 'uploads'
      if (file.type.startsWith('image/')) {
        prefix = 'blogs'
      }
      key = `${prefix}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    }

    let publicUrl = ''
    if (isR2Configured()) {
      publicUrl = await uploadToR2(buffer, key, file.type)
    } else {
      const localPath = path.resolve(process.cwd(), 'public', key)
      const parentDir = path.dirname(localPath)
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }
      fs.writeFileSync(localPath, buffer)
      publicUrl = `/${key}`
    }

    await logAudit({
      category: 'system',
      action: 'bucket.object_uploaded',
      target: key,
      actorId: admin.id,
      actorName: admin.name
    })

    return { success: true, key, url: publicUrl }
  } catch (error: any) {
    console.error('Bucket upload failed:', error)
    return { success: false, error: error.message || 'File upload failed.' }
  }
}

/**
 * Creates a virtual folder (an empty object ending in /).
 */
export async function createFolderAction(folderName: string, prefix: string) {
  const admin = await ensureSuperAdmin()

  if (!folderName || !folderName.trim()) {
    return { success: false, error: 'Folder name is required.' }
  }

  const cleanName = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  const basePrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : ''
  const key = `${basePrefix}${cleanName}/`

  try {
    if (isR2Configured()) {
      await putObject(key, Buffer.from(''), 'application/x-directory')
    } else {
      const localPath = path.resolve(process.cwd(), 'public', key)
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true })
      }
    }

    await logAudit({
      category: 'system',
      action: 'bucket.folder_created',
      target: key,
      actorId: admin.id,
      actorName: admin.name
    })

    return { success: true, key }
  } catch (error: any) {
    console.error('Failed to create folder:', error)
    return { success: false, error: error.message || 'Folder creation failed.' }
  }
}

/**
 * Deletes a single object from storage.
 */
export async function deleteBucketObjectAction(key: string) {
  const admin = await ensureSuperAdmin()

  if (!key) {
    return { success: false, error: 'No key specified for deletion.' }
  }

  try {
    if (isR2Configured()) {
      if (key.endsWith('/')) {
        // List and delete all nested objects matching the directory prefix
        const contents = await listObjects(key)
        const allKeysToDelete = contents.map(item => item.key)
        if (!allKeysToDelete.includes(key)) {
          allKeysToDelete.push(key)
        }

        await deleteObjects(allKeysToDelete)
      } else {
        await deleteObject(key)
      }
    } else {
      const cleanKey = key.startsWith('/') ? key.slice(1) : key
      const localPath = path.resolve(process.cwd(), 'public', cleanKey)
      if (fs.existsSync(localPath)) {
        const stat = fs.statSync(localPath)
        if (stat.isFile()) {
          fs.unlinkSync(localPath)
        } else if (stat.isDirectory()) {
          fs.rmSync(localPath, { recursive: true, force: true })
        }
      } else {
        return { success: false, error: 'Item does not exist in local directory.' }
      }
    }

    await logAudit({
      category: 'system',
      action: 'bucket.object_deleted',
      target: key,
      actorId: admin.id,
      actorName: admin.name
    })

    return { success: true }
  } catch (error: any) {
    console.error('Bucket object deletion failed:', error)
    return { success: false, error: error.message || 'File deletion failed.' }
  }
}

/**
 * Deletes multiple objects in bulk.
 */
export async function deleteMultipleBucketObjectsAction(keys: string[]) {
  const admin = await ensureSuperAdmin()

  if (!keys || keys.length === 0) {
    return { success: false, error: 'No files selected for deletion.' }
  }

  try {
    if (isR2Configured()) {
      const allKeysToDelete: string[] = []
      for (const key of keys) {
        if (key.endsWith('/')) {
          // List and delete all nested objects matching the directory prefix
          const contents = await listObjects(key)
          for (const item of contents) {
            allKeysToDelete.push(item.key)
          }
          if (!allKeysToDelete.includes(key)) {
            allKeysToDelete.push(key)
          }
        } else {
          allKeysToDelete.push(key)
        }
      }

      await deleteObjects(allKeysToDelete)
    } else {
      for (const key of keys) {
        const cleanKey = key.startsWith('/') ? key.slice(1) : key
        const localPath = path.resolve(process.cwd(), 'public', cleanKey)
        if (fs.existsSync(localPath)) {
          const stat = fs.statSync(localPath)
          if (stat.isFile()) {
            fs.unlinkSync(localPath)
          } else if (stat.isDirectory()) {
            fs.rmSync(localPath, { recursive: true, force: true })
          }
        }
      }
    }

    await logAudit({
      category: 'system',
      action: 'bucket.bulk_deleted',
      target: `${keys.length} items`,
      actorId: admin.id,
      actorName: admin.name
    })

    return { success: true }
  } catch (error: any) {
    console.error('Bulk deletion failed:', error)
    return { success: false, error: error.message || 'Bulk deletion failed.' }
  }
}

export interface MetricDataPoint {
  time: string
  classA: number
  classB: number
}

export interface CloudflareR2Metrics {
  classA: number
  classB: number
  averageStorage: number
  dataRetrieved: number
  requestDistribution: Array<{ region: string; percentage: number }>
  timeseries: MetricDataPoint[]
}

/**
 * Retrieves storage and operations metrics from Cloudflare GraphQL API if token is configured,
 * otherwise calculates size locally and simulates/falls back to tracked operations.
 */
export async function getR2MetricsAction(): Promise<{ success: boolean; metrics: CloudflareR2Metrics; error?: string }> {
  await ensureAdmin()

  let averageStorage = 0
  let classA = 0
  let classB = 0
  let dataRetrieved = 0
  let requestDistribution: Array<{ region: string; percentage: number }> = []

  // Generate 24 hourly buckets for timeseries data
  const timeseries: MetricDataPoint[] = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000)
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:00`
    timeseries.push({
      time: timeStr,
      classA: 0,
      classB: 0
    })
  }

  // Calculate current storage size
  try {
    const listRes = await listBucketObjectsAction()
    if (listRes.success && listRes.objects) {
      averageStorage = listRes.objects.reduce((sum, o) => sum + o.size, 0)
    }
  } catch (e) {
    console.error('Failed to sum local bucket sizes:', e)
  }

  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || ''
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || ''
  const match = endpoint.match(/https:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com/)
  const accountId = match ? match[1] : ''

  let cfDataLoaded = false

  if (apiToken && accountId && bucketName) {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const query = `
        query GetR2Metrics($accountId: String!, $bucketName: String!, $yesterday: String!) {
          viewer {
            accounts(filter: { accountTag: $accountId }) {
              r2OperationsAdaptiveGroups(
                limit: 1000
                filter: { bucketName: $bucketName, datetime_gt: $yesterday }
              ) {
                sum {
                  requests
                }
                dimensions {
                  datetime
                  actionType
                }
              }
              r2StorageAdaptiveGroups(
                limit: 1
                filter: { bucketName: $bucketName, datetime_gt: $yesterday }
              ) {
                max {
                  payloadSize
                }
              }
            }
          }
        }
      `

      const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables: { accountId, bucketName, yesterday }
        }),
        next: { revalidate: 60 }
      })

      if (res.ok) {
        const body = await res.json()
        const accountData = body.data?.viewer?.accounts?.[0]
        
        if (accountData) {
          cfDataLoaded = true
          const opsGroups = accountData.r2OperationsAdaptiveGroups || []
          let totalA = 0
          let totalB = 0
          
          const classBActions = ['GetObject', 'HeadObject', 'GetObjectAcl', 'HeadBucket']

          // Map the GraphQL results directly onto our 24 hourly buckets
          for (const group of opsGroups) {
            const reqs = Number(group.sum?.requests || 0)
            const action = group.dimensions?.actionType || ''
            
            const isClassB = classBActions.includes(action)
            
            if (isClassB) {
              totalB += reqs
            } else {
              totalA += reqs
            }

            // Timeseries hourly mapping
            if (group.dimensions?.datetime) {
              const dateObj = new Date(group.dimensions.datetime)
              const hourStr = `${String(dateObj.getHours()).padStart(2, '0')}:00`
              const slot = timeseries.find(t => t.time === hourStr)
              if (slot) {
                if (isClassB) {
                  slot.classB += reqs
                } else {
                  slot.classA += reqs
                }
              }
            }
          }

          classA = totalA
          classB = totalB

          // Extract storage size
          const storageGroups = accountData.r2StorageAdaptiveGroups || []
          if (storageGroups.length > 0 && storageGroups[0].max?.payloadSize) {
            averageStorage = Number(storageGroups[0].max.payloadSize)
          }
        }
      }
    } catch (e: any) {
      console.warn('Cloudflare GraphQL query failed. Falling back to local simulation:', e.message || e)
    }
  }

  // Fallback simulation: if CF data couldn't load, map the peak to the last hourly bucket 
  // to perfectly match the Cloudflare visual spike!
  if (!cfDataLoaded) {
    timeseries[timeseries.length - 1].classA = classA
    timeseries[timeseries.length - 1].classB = classB
  }

  return {
    success: true,
    metrics: {
      classA,
      classB,
      averageStorage,
      dataRetrieved,
      requestDistribution,
      timeseries
    }
  }
}
