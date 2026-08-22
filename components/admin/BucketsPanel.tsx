'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  getR2ConfigAction, 
  saveR2ConfigAction, 
  listBucketObjectsAction, 
  uploadBucketObjectAction, 
  deleteBucketObjectAction,
  deleteMultipleBucketObjectsAction,
  createFolderAction,
  getR2MetricsAction,
  type BucketObject,
  type CloudflareR2Metrics
} from '@/lib/actions/bucket-actions'
import { 
  RefreshCw, 
  Copy, 
  Check, 
  HardDrive, 
  Cloud, 
  FolderOpen, 
  UploadCloud, 
  Trash2, 
  Search, 
  Settings, 
  File, 
  AlertTriangle,
  ExternalLink,
  Plus,
  Folder,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  FolderPlus,
  BarChart3,
  Globe2,
  Calendar,
  Lock
} from 'lucide-react'
import { toast } from '@/components/shared/Toast'
import { PanelSkeleton } from '@/components/ui/Skeleton'

interface BucketsPanelProps {
  currentAdmin?: {
    id: string
    name: string
    email: string
    username: string | null
    role: 'super_admin' | 'admin'
  } | null
}

export default function BucketsPanel({ currentAdmin }: BucketsPanelProps) {
  const isSuperAdmin = currentAdmin?.role === 'super_admin'

  // Copy indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // Storage settings form state
  const [config, setConfig] = useState({
    accessKeyId: '',
    secretAccessKey: '',
    endpoint: '',
    bucketName: '',
    publicUrl: '',
    apiToken: '',
    isConfigured: false
  })

  // Subtabs: explorer, metrics, settings
  const [activeSubTab, setActiveSubTab] = useState<'explorer' | 'metrics' | 'settings'>('explorer')
  
  // Folders and prefix logic
  const [objects, setObjects] = useState<BucketObject[]>([])
  const [currentPrefix, setCurrentPrefix] = useState<string>('') // e.g. "blogs/" or ""
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  // Selection logic for bulk actions
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // Pagination
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(0)

  // Inline image preview accordion — only one row open at a time (FAQ-style).
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  function toggleExpanded(key: string) {
    setExpandedKey(prev => (prev === key ? null : key))
  }

  // Folder creation modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [metrics, setMetrics] = useState<CloudflareR2Metrics>({
    classA: 0,
    classB: 0,
    averageStorage: 0,
    dataRetrieved: 0,
    requestDistribution: [],
    timeseries: []
  })
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  // Hover states for graphs
  const [hoveredIdxA, setHoveredIdxA] = useState<number | null>(null)
  const [hoveredIdxB, setHoveredIdxB] = useState<number | null>(null)

  // Get point timestamp label
  const getPointTimestamp = (index: number) => {
    const ts = metrics.timeseries || []
    if (ts.length === 0 || index === null || index < 0 || index >= ts.length) return ''
    const offsetHours = (ts.length - 1 - index)
    const dateObj = new Date(Date.now() - offsetHours * 60 * 60 * 1000)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[dateObj.getMonth()]
    const date = dateObj.getDate()
    const time = ts[index].time
    return `${month} ${date}, ${time}:00`
  }
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch configuration and files — independent of each other, run concurrently.
  async function loadData() {
    setLoading(true)
    try {
      const [configRes, objectsRes] = await Promise.all([
        getR2ConfigAction(),
        listBucketObjectsAction(),
      ])
      if (configRes.success && configRes.config) {
        setConfig({
          accessKeyId: configRes.config.accessKeyId,
          secretAccessKey: configRes.config.secretAccessKey,
          endpoint: configRes.config.endpoint,
          bucketName: configRes.config.bucketName,
          publicUrl: configRes.config.publicUrl,
          apiToken: configRes.config.apiToken,
          isConfigured: configRes.config.isConfigured
        })
      }

      if (objectsRes.success && objectsRes.objects) {
        setObjects(objectsRes.objects)
      } else if (objectsRes.error) {
        toast(objectsRes.error, 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Failed to fetch storage data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load metrics data
  async function loadMetrics() {
    setLoadingMetrics(true)
    try {
      const res = await getR2MetricsAction()
      if (res.success && res.metrics) {
        setMetrics(res.metrics)
      }
    } catch (err: any) {
      console.error('Failed to load metrics:', err)
    } finally {
      setLoadingMetrics(false)
    }
  }

  // Master refresh function that reloads metrics immediately
  async function handleRefresh() {
    await Promise.all([loadData(), loadMetrics()])
  }

  useEffect(() => {
    Promise.all([loadData(), loadMetrics()])
  }, [])

  useEffect(() => {
    if (activeSubTab === 'metrics') {
      loadMetrics()
    }
  }, [activeSubTab])

  // Reset checkboxes and any open image preview when changing prefixes/folders
  useEffect(() => {
    setSelectedKeys([])
    setExpandedKey(null)
  }, [currentPrefix])

  // Handle configuration form submission
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) {
      toast('Operation forbidden: Super Admin permissions required.', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await saveR2ConfigAction({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        endpoint: config.endpoint,
        bucketName: config.bucketName,
        publicUrl: config.publicUrl,
        apiToken: config.apiToken
      })

      if (res.success) {
        toast('Storage configurations saved to .env.local successfully!', 'success')
        await loadData()
      } else {
        toast(res.error || 'Failed to save settings.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred while saving configuration.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle file upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isSuperAdmin) {
      toast('Operation forbidden: Super Admin permissions required.', 'error')
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('prefix', currentPrefix)

    try {
      const res = await uploadBucketObjectAction(formData)
      if (res.success) {
        toast(`File "${file.name}" uploaded successfully!`, 'success')
        const objectsRes = await listBucketObjectsAction()
        if (objectsRes.success && objectsRes.objects) {
          setObjects(objectsRes.objects)
        }
      } else {
        toast(res.error || 'Failed to upload file.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred during file upload.', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle virtual folder creation
  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) {
      toast('Operation forbidden: Super Admin permissions required.', 'error')
      return
    }

    if (!newFolderName.trim()) return

    setLoading(true)
    try {
      const res = await createFolderAction(newFolderName, currentPrefix)
      if (res.success) {
        toast(`Folder "${newFolderName}" created successfully.`, 'success')
        setIsFolderModalOpen(false)
        setNewFolderName('')
        // Refresh explorer
        const objectsRes = await listBucketObjectsAction()
        if (objectsRes.success && objectsRes.objects) {
          setObjects(objectsRes.objects)
        }
      } else {
        toast(res.error || 'Failed to create folder.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred during folder creation.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle file deletion
  async function handleDeleteFile(key: string) {
    if (!isSuperAdmin) {
      toast('Operation forbidden: Super Admin permissions required.', 'error')
      return
    }

    if (!confirm(`Are you sure you want to permanently delete "${key}"?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await deleteBucketObjectAction(key)
      if (res.success) {
        toast(`"${key}" deleted successfully.`, 'success')
        setObjects(prev => prev.filter(o => o.key !== key))
      } else {
        toast(res.error || 'Failed to delete object.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred during deletion.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle bulk file deletion
  async function handleBulkDelete() {
    if (!isSuperAdmin) {
      toast('Operation forbidden: Super Admin permissions required.', 'error')
      return
    }

    if (selectedKeys.length === 0) return

    if (!confirm(`Are you sure you want to permanently delete ${selectedKeys.length} files?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await deleteMultipleBucketObjectsAction(selectedKeys)
      if (res.success) {
        toast(`Deleted ${selectedKeys.length} files successfully.`, 'success')
        setObjects(prev => prev.filter(o => !selectedKeys.includes(o.key)))
        setSelectedKeys([])
      } else {
        toast(res.error || 'Failed to delete selected objects.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred during bulk deletion.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Copy link helper
  function handleCopyUrl(url: string, key: string) {
    const resolvedUrl = url.startsWith('/') 
      ? `${window.location.origin}${url}` 
      : url

    navigator.clipboard.writeText(resolvedUrl)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    toast('Link copied to clipboard!', 'success')
  }

  // Helper formatting size
  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Helper variables for Cloudflare-styled metrics graphs
  const yTicksA = [100, 80, 60, 40, 20, 0]
  const yTicksB = [60, 50, 40, 30, 20, 10, 0]
  
  const maxValA = Math.max(100, ...(metrics.timeseries || []).map(d => d.classA))
  const maxValB = Math.max(60, ...(metrics.timeseries || []).map(d => d.classB))

  const pointsA = (metrics.timeseries || []).map((d, i) => {
    const x = (i / ((metrics.timeseries || []).length - 1 || 1)) * 100
    const y = 100 - (d.classA / maxValA) * 100
    return `${x},${y}`
  }).join(' ')

  const pointsB = (metrics.timeseries || []).map((d, i) => {
    const x = (i / ((metrics.timeseries || []).length - 1 || 1)) * 100
    const y = 100 - (d.classB / maxValB) * 100
    return `${x},${y}`
  }).join(' ')

  // Calculate dynamic timeline ticks from the hours in the timeseries
  const timelineTicks = (() => {
    const ts = metrics.timeseries || []
    const result: Array<{ percent: number; label: string }> = []
    if (ts.length === 0) return result
    
    // Start of the timeline represents the day of month for the earliest point
    const firstDate = new Date(Date.now() - (ts.length - 1) * 60 * 60 * 1000)
    result.push({
      percent: 0,
      label: firstDate.getDate().toString()
    })

    // Sub-ticks matching specific local hours
    for (let i = 1; i < ts.length; i++) {
      const time = ts[i].time
      if (['04:00', '08:00', '12:00', '16:00', '20:00'].includes(time)) {
        result.push({
          percent: (i / (ts.length - 1)) * 100,
          label: time
        })
      }
    }
    return result
  })()

  // Parse direct subfolders and files in the current prefix path
  const parsedItems = React.useMemo(() => {
    const foldersMap = new Map<string, { key: string; name: string; size: number; lastModified: string; isFolder: boolean }>()
    const filesList: Array<{ key: string; name: string; size: number; lastModified: string; url: string; isFolder: boolean; contentType: string }> = []

    for (const obj of objects) {
      if (obj.key === currentPrefix) continue // Skip prefix self-placeholder object
      if (obj.key.startsWith(currentPrefix)) {
        const relative = obj.key.slice(currentPrefix.length)
        const parts = relative.split('/')

        if (parts.length > 1) {
          // It's in a subfolder
          const folderName = parts[0] + '/'
          const folderKey = `${currentPrefix}${folderName}`
          if (!foldersMap.has(folderKey)) {
            foldersMap.set(folderKey, {
              key: folderKey,
              name: parts[0],
              size: 0,
              lastModified: obj.lastModified,
              isFolder: true
            })
          } else {
            // Update folder sizing/mod timings by aggregation
            const current = foldersMap.get(folderKey)!
            current.size += obj.size
            if (new Date(obj.lastModified).getTime() > new Date(current.lastModified).getTime()) {
              current.lastModified = obj.lastModified
            }
          }
        } else {
          // It's a file
          if (relative === '') continue // ignore empty files representing folder keys
          filesList.push({
            key: obj.key,
            name: relative,
            size: obj.size,
            lastModified: obj.lastModified,
            url: obj.url,
            isFolder: false,
            contentType: obj.contentType || 'application/octet-stream'
          })
        }
      }
    }

    // Always show files newest-first (latest modified at the top); folders stay
    // grouped above the files.
    filesList.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    return [
      ...Array.from(foldersMap.values()),
      ...filesList
    ]
  }, [objects, currentPrefix])

  // Filter items matching search bar
  const filteredItems = parsedItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(currentPage, totalPages - 1)
  const pagedItems = filteredItems.slice(safePage * pageSize, safePage * pageSize + pageSize)

  // Selection list logic — operate on the full filtered list, not just the page
  const fileKeysInCurrentView = filteredItems.map(i => i.key)
  const allSelected = fileKeysInCurrentView.length > 0 && fileKeysInCurrentView.every(k => selectedKeys.includes(k))

  function handleSelectAll() {
    if (allSelected) {
      setSelectedKeys(prev => prev.filter(k => !fileKeysInCurrentView.includes(k)))
    } else {
      setSelectedKeys(prev => {
        const added = fileKeysInCurrentView.filter(k => !prev.includes(k))
        return [...prev, ...added]
      })
    }
  }

  function handleSelectItem(key: string) {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // Drill down directory prefix path
  function handleEnterFolder(folderKey: string) {
    setCurrentPrefix(folderKey)
    setSearchQuery('')
    setCurrentPage(0)
  }

  // Navigate back to parents in breadcrumbs
  function handleNavigateBreadcrumb(index: number, segments: string[]) {
    if (index === -1) {
      setCurrentPrefix('')
    } else {
      const newPrefix = segments.slice(0, index + 1).join('/') + '/'
      setCurrentPrefix(newPrefix)
    }
    setSearchQuery('')
  }

  // Split prefix to segment parts for breadcrumbs
  const breadcrumbSegments = currentPrefix ? currentPrefix.split('/').filter(Boolean) : []
  const totalStorageSize = objects.reduce((acc, o) => acc + o.size, 0)

  if (loading && objects.length === 0) {
    return <PanelSkeleton />
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 text-left select-none bg-[#070709] text-white font-sans h-full min-h-0">
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Storage &amp; R2 Buckets
          </h1>
          <div className="flex items-center gap-2">
            <span className={`border px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5 ${
              config.isConfigured 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {config.isConfigured ? 'CLOUDFLARE R2 CONNECTED' : "CLOUDFLARE ISN'T CONNECTED"}
            </span>
            {!isSuperAdmin && (
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                READ-ONLY ACCESS
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-lg text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* R2 Dashboard Summary Metrics */}
      {config.isConfigured && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Default Storage Class</div>
            <div className="text-lg font-mono font-bold text-white">Standard</div>
            <div className="text-[9px] text-white/30 leading-snug">Default class for bucket.</div>
          </div>

          <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Public Access</div>
            <div className="text-lg font-mono font-bold text-white flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${config.publicUrl ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {config.publicUrl ? 'Enabled' : 'Disabled'}
            </div>
            <div className="text-[9px] text-white/30 leading-snug truncate" title={config.publicUrl}>
              {config.publicUrl || 'No public domain set.'}
            </div>
          </div>

          <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Bucket Size</div>
            <div className="text-lg font-mono font-bold text-white">{formatBytes(totalStorageSize)}</div>
            <div className="text-[9px] text-white/30 leading-snug">Total size of listed objects.</div>
          </div>

          <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Class A Operations</div>
            <div className="text-lg font-mono font-bold text-accent">{metrics.classA}</div>
            <div className="text-[9px] text-white/30 leading-snug">Object mutations count.</div>
          </div>

          <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Class B Operations</div>
            <div className="text-lg font-mono font-bold text-accent">{metrics.classB}</div>
            <div className="text-[9px] text-white/30 leading-snug">Object downloads count.</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        
        <div className="border-b border-white/[0.06] flex items-center gap-5">
          {config.isConfigured && (
            <>
              <button
                onClick={() => setActiveSubTab('explorer')}
                className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
                  activeSubTab === 'explorer'
                    ? "border-accent text-accent"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                Objects Explorer
              </button>
              <button
                onClick={() => setActiveSubTab('metrics')}
                className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
                  activeSubTab === 'metrics'
                    ? "border-accent text-accent"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                Bucket Metrics
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveSubTab('settings')}
              className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
                activeSubTab === 'settings'
                  ? "border-accent text-accent"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              Bucket Settings
            </button>
          )}
        </div>

        {/* Tab 1: Objects Explorer */}
        {config.isConfigured && activeSubTab === 'explorer' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Folder / breadcrumbs path navigation & action triggers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b0b0e] border border-white/[0.04] p-3 rounded-xl">
              
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-xs font-medium font-sans">
                <button 
                  onClick={() => handleNavigateBreadcrumb(-1, [])}
                  className="text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  {config.isConfigured ? config.bucketName : 'forke-assets'}
                </button>
                
                {breadcrumbSegments.map((segment, index) => (
                  <React.Fragment key={index}>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                    <button 
                      onClick={() => handleNavigateBreadcrumb(index, breadcrumbSegments)}
                      className="text-white/60 hover:text-white transition-colors cursor-pointer"
                    >
                      {segment}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedKeys.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={!isSuperAdmin}
                    className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-[11px] font-semibold text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete {selectedKeys.length} files</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!isSuperAdmin) {
                      toast('Super Admin privileges required to create folders.', 'error')
                      return
                    }
                    setIsFolderModalOpen(true)
                  }}
                  disabled={!isSuperAdmin}
                  className="px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] disabled:opacity-40 border border-white/[0.06] rounded-lg text-[11px] font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-white/70" />
                  <span>Add folder</span>
                </button>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button
                  onClick={() => {
                    if (!isSuperAdmin) {
                      toast('Super Admin privileges required to upload files.', 'error')
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                  disabled={uploading || !isSuperAdmin}
                  className="px-2.5 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-[11px] font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {uploading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>Upload</span>
                </button>
              </div>

            </div>

            {/* Search filter */}
            <div className="flex items-center gap-2 bg-[#0b0b0e] border border-white/[0.06] rounded-xl px-3 py-2 max-w-md">
              <Search className="w-4 h-4 text-white/30" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search objects in current view..." 
                className="bg-transparent border-none text-xs text-white placeholder-white/20 focus:outline-none w-full font-mono"
              />
            </div>

            {/* Objects table matching cloudflare dashboard */}
            <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#0b0b0e]">
              <table className="w-full min-w-[680px] border-collapse font-sans text-xs text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold select-none">
                    <th className="w-10 px-4 py-3">
                      <input 
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        className="rounded !border-white/20 !bg-black checked:!bg-accent text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 transition-colors"
                      />
                    </th>
                    <th className="px-4 py-3">Objects</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Storage Class</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Modified</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {filteredItems.length > 0 ? (
                    pagedItems.map(item => {
                      const itemContentType = (item as any).contentType as string | undefined
                      const isImage = !item.isFolder && !!itemContentType && itemContentType.startsWith('image/')
                      const isExpanded = expandedKey === item.key
                      return (
                      <React.Fragment key={item.key}>
                      <tr className="hover:bg-white/[0.01] transition-colors group">
                        
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox"
                            checked={selectedKeys.includes(item.key)}
                            onChange={() => handleSelectItem(item.key)}
                            className="rounded !border-white/20 !bg-black checked:!bg-accent text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 transition-colors"
                          />
                        </td>

                        {/* Name Column */}
                        <td className="px-4 py-3.5">
                          {item.isFolder ? (
                            <button
                              onClick={() => handleEnterFolder(item.key)}
                              className="text-accent font-bold hover:underline cursor-pointer flex items-center gap-2 text-left"
                            >
                              <Folder className="w-4 h-4 text-accent/70 shrink-0" />
                              <span>{item.name}/</span>
                            </button>
                          ) : (
                            <div className="text-white/80 font-medium flex items-center gap-2">
                              <File className="w-4 h-4 text-white/30 shrink-0" />
                              <span className="truncate max-w-[240px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Type Column */}
                        <td className="px-4 py-3.5 text-white/50 font-sans">
                          {item.isFolder ? 'Folder' : (item as any).contentType || 'application/octet-stream'}
                        </td>

                        {/* Storage Class */}
                        <td className="px-4 py-3.5 text-white/40 font-sans">
                          Standard
                        </td>

                        {/* Size Column */}
                        <td className="px-4 py-3.5 text-white/50">
                          {item.isFolder ? '--' : formatBytes(item.size)}
                        </td>

                        {/* Modified Column */}
                        <td className="px-4 py-3.5 text-white/40 text-[11px] font-sans">
                          {item.isFolder ? '--' : new Date(item.lastModified).toLocaleString()}
                        </td>

                        {/* Actions Column */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1 flex-nowrap whitespace-nowrap">
                          {!item.isFolder ? (
                            <>
                              <button
                                onClick={() => handleCopyUrl((item as any).url, item.key)}
                                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
                                title="Copy public link"
                              >
                                {copiedKey === item.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>

                              {isImage ? (
                                <button
                                  onClick={() => toggleExpanded(item.key)}
                                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer inline-flex items-center shrink-0"
                                  title={isExpanded ? 'Hide preview' : 'Show preview'}
                                  aria-expanded={isExpanded}
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              ) : (
                                <a
                                  href={(item as any).url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer inline-flex items-center shrink-0"
                                  title="Open file in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              <button
                                onClick={() => handleDeleteFile(item.key)}
                                disabled={!isSuperAdmin}
                                className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/20 transition-colors cursor-pointer shrink-0"
                                title="Delete file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleDeleteFile(item.key)}
                              disabled={!isSuperAdmin}
                              className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/20 transition-colors cursor-pointer shrink-0"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          </div>
                        </td>

                      </tr>

                      {/* Inline image preview — expands downward, one open at a time */}
                      {isImage && isExpanded && (
                        <tr className="bg-black/20">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={(item as any).url}
                                alt={item.name}
                                className="max-h-80 max-w-full rounded-lg border border-white/[0.08] object-contain bg-black/30"
                              />
                              <a
                                href={(item as any).url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-sans text-white/40 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open original in new tab
                              </a>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-white/30 font-sans">
                        No files or folders found in current view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06] shrink-0 bg-white/[0.005]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-white/30">Rows:</span>
                {[10, 50, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setPageSize(n); setCurrentPage(0) }}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${pageSize === n ? 'bg-white/[0.06] text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/30">
                  {filteredItems.length === 0 ? '0' : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, filteredItems.length)}`} of {filteredItems.length}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="text-[11px] font-mono text-white/40 hover:text-white disabled:opacity-25 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="text-[11px] font-mono text-white/40 hover:text-white disabled:opacity-25 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Folder creation overlay modal */}
            {isFolderModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-sm bg-[#0c0c0e] border border-white/[0.08] rounded-xl p-5 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-accent" />
                      Create Virtual Folder
                    </h4>
                    <p className="text-[11px] text-white/40">
                      Creates a folder prefix directory placeholder in your R2 bucket.
                    </p>
                  </div>
                  
                  <form onSubmit={handleCreateFolder} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-white/40 block">Folder Name</label>
                      <input 
                        type="text" 
                        required
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        placeholder="e.g. avatars"
                        className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-0"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 text-xs font-semibold pt-1">
                      <button 
                        type="button"
                        onClick={() => { setIsFolderModalOpen(false); setNewFolderName(''); }}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-white transition-colors cursor-pointer"
                      >
                        Create Folder
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab 2: Metrics Dashboard */}
        {config.isConfigured && activeSubTab === 'metrics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Metrics Dashboard</span>
              </div>
              
              <div className="flex items-center gap-2 bg-[#0b0b0e] border border-white/[0.06] rounded-lg px-3 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-white/40" />
                <span className="text-white/60 font-medium">Last 24 hours</span>
              </div>
            </div>

            {loadingMetrics ? (
              <div className="flex items-center justify-center min-h-[300px] bg-[#0b0b0e] border border-white/[0.06] rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                  <span className="text-[11px] font-mono text-white/40">Gathering Cloudflare GraphQL analytics...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Metric Summary Widgets */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider block">Average Storage</span>
                    <h3 className="text-xl font-mono font-bold text-white mt-1">{formatBytes(metrics.averageStorage)}</h3>
                  </div>

                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider block">Data Retrieved</span>
                    <h3 className="text-xl font-mono font-bold text-white mt-1">{formatBytes(metrics.dataRetrieved)}</h3>
                  </div>

                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider block">Class A Operations</span>
                    <h3 className="text-xl font-mono font-bold text-accent mt-1">{metrics.classA}</h3>
                  </div>

                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider block">Class B Operations</span>
                    <h3 className="text-xl font-mono font-bold text-accent mt-1">{metrics.classB}</h3>
                  </div>

                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider block">Requests Count</span>
                    <h3 className="text-xl font-mono font-bold text-white mt-1">{metrics.classA + metrics.classB}</h3>
                  </div>
                </div>

                {/* Visual Graphs Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Graph 1: Class A Operations */}
                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                        Class A Operations
                      </div>
                      <div className="flex items-end gap-10 pt-1">
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Total</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">{metrics.classA}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Average</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">{metrics.classA}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Minimum</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">0</div>
                        </div>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="flex items-stretch gap-2 h-44 mt-4 select-none">
                      {/* Y-Axis Column */}
                      <div className="flex items-center gap-1.5 shrink-0 h-full">
                        <div className="relative w-4 h-full flex items-center justify-center">
                          <span className="absolute text-[8px] text-white/30 uppercase tracking-widest font-bold font-sans -rotate-90 origin-center whitespace-nowrap">
                            Operations
                          </span>
                        </div>
                        <div className="flex flex-col justify-between h-full text-[9px] font-mono text-white/50 text-right w-6 leading-none py-1">
                          {yTicksA.map((tick, i) => (
                            <span key={i}>{tick}</span>
                          ))}
                        </div>
                      </div>

                      {/* SVG Canvas Area */}
                      <div 
                        className="flex-grow relative border border-white/[0.08] bg-black/[0.15] rounded overflow-hidden cursor-crosshair"
                        onMouseMove={(e) => {
                          if (!metrics.timeseries || metrics.timeseries.length === 0) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const pct = Math.max(0, Math.min(1, x / rect.width))
                          const idx = Math.round(pct * (metrics.timeseries.length - 1))
                          setHoveredIdxA(idx)
                        }}
                        onMouseLeave={() => setHoveredIdxA(null)}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                          {yTicksA.map((_, i) => (
                            <div key={i} className="border-b border-white/[0.06] w-full h-0 last:border-0" />
                          ))}
                        </div>

                        {/* Line Graph */}
                        <svg className="absolute inset-0 w-full h-full p-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polyline 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="2" 
                            vectorEffect="non-scaling-stroke"
                            points={pointsA} 
                          />
                        </svg>

                        {/* Hover elements */}
                        {hoveredIdxA !== null && metrics.timeseries[hoveredIdxA] && (
                          <>
                            {/* Vertical Guide Line */}
                            <div 
                              className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-blue-400/60 pointer-events-none"
                              style={{ left: `${(hoveredIdxA / (metrics.timeseries.length - 1)) * 100}%` }}
                            />
                            {/* Hover Dot */}
                            <div 
                              className="absolute w-2 h-2 rounded-full bg-blue-500 border border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-md"
                              style={{ 
                                left: `${(hoveredIdxA / (metrics.timeseries.length - 1)) * 100}%`,
                                top: `${100 - (metrics.timeseries[hoveredIdxA].classA / maxValA) * 100}%`
                              }}
                            />
                            {/* Tooltip */}
                            <div 
                              className="absolute top-2 bg-[#0c0c0e]/95 backdrop-blur border border-white/[0.08] rounded-lg p-2 text-left shadow-2xl text-[10px] space-y-1.5 z-20 pointer-events-none w-32 font-sans"
                              style={{ 
                                left: `${(hoveredIdxA / (metrics.timeseries.length - 1)) * 100}%`,
                                transform: hoveredIdxA > (metrics.timeseries.length / 2) ? 'translateX(-115%)' : 'translateX(15%)'
                              }}
                            >
                              <div className="text-white/40 font-mono font-medium leading-none">
                                {getPointTimestamp(hoveredIdxA)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span className="text-white/60">Standard</span>
                                <span className="font-mono font-bold ml-auto text-white">
                                  {metrics.timeseries[hoveredIdxA].classA}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* X-Axis Timeline */}
                    <div className="pl-12">
                      <div className="relative border-t border-white/[0.08] h-5 pt-1">
                        {timelineTicks.map((tick, idx) => (
                          <React.Fragment key={idx}>
                            <span 
                              className="absolute top-0 w-[1px] h-1.5 bg-white/40"
                              style={{ left: `${tick.percent}%` }}
                            />
                            <span 
                              className="absolute top-1.5 text-[9px] font-mono text-white/40 select-none whitespace-nowrap"
                              style={{ 
                                left: `${tick.percent}%`,
                                transform: tick.percent === 0 ? 'none' : tick.percent === 100 ? 'translateX(-100%)' : 'translateX(-50%)'
                              }}
                            >
                              {tick.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="text-center text-[9px] text-white/30 font-semibold font-sans tracking-wide uppercase mt-1">
                        Time (GMT+5:30)
                      </div>
                    </div>
                  </div>

                  {/* Graph 2: Class B Operations */}
                  <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-5 space-y-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                        Class B Operations
                      </div>
                      <div className="flex items-end gap-10 pt-1">
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Total</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">{metrics.classB}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Average</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">{metrics.classB}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase font-semibold tracking-wider">Minimum</div>
                          <div className="text-xl font-mono font-bold text-white mt-0.5">0</div>
                        </div>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="flex items-stretch gap-2 h-44 mt-4 select-none">
                      {/* Y-Axis Column */}
                      <div className="flex items-center gap-1.5 shrink-0 h-full">
                        <div className="relative w-4 h-full flex items-center justify-center">
                          <span className="absolute text-[8px] text-white/30 uppercase tracking-widest font-bold font-sans -rotate-90 origin-center whitespace-nowrap">
                            Operations
                          </span>
                        </div>
                        <div className="flex flex-col justify-between h-full text-[9px] font-mono text-white/50 text-right w-6 leading-none py-1">
                          {yTicksB.map((tick, i) => (
                            <span key={i}>{tick}</span>
                          ))}
                        </div>
                      </div>

                      {/* SVG Canvas Area */}
                      <div 
                        className="flex-grow relative border border-white/[0.08] bg-black/[0.15] rounded overflow-hidden cursor-crosshair"
                        onMouseMove={(e) => {
                          if (!metrics.timeseries || metrics.timeseries.length === 0) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const pct = Math.max(0, Math.min(1, x / rect.width))
                          const idx = Math.round(pct * (metrics.timeseries.length - 1))
                          setHoveredIdxB(idx)
                        }}
                        onMouseLeave={() => setHoveredIdxB(null)}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                          {yTicksB.map((_, i) => (
                            <div key={i} className="border-b border-white/[0.06] w-full h-0 last:border-0" />
                          ))}
                        </div>

                        {/* Line Graph */}
                        <svg className="absolute inset-0 w-full h-full p-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polyline 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="2" 
                            vectorEffect="non-scaling-stroke"
                            points={pointsB} 
                          />
                        </svg>

                        {/* Hover elements */}
                        {hoveredIdxB !== null && metrics.timeseries[hoveredIdxB] && (
                          <>
                            {/* Vertical Guide Line */}
                            <div 
                              className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-blue-400/60 pointer-events-none"
                              style={{ left: `${(hoveredIdxB / (metrics.timeseries.length - 1)) * 100}%` }}
                            />
                            {/* Hover Dot */}
                            <div 
                              className="absolute w-2 h-2 rounded-full bg-blue-500 border border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-md"
                              style={{ 
                                left: `${(hoveredIdxB / (metrics.timeseries.length - 1)) * 100}%`,
                                top: `${100 - (metrics.timeseries[hoveredIdxB].classB / maxValB) * 100}%`
                              }}
                            />
                            {/* Tooltip */}
                            <div 
                              className="absolute top-2 bg-[#0c0c0e]/95 backdrop-blur border border-white/[0.08] rounded-lg p-2 text-left shadow-2xl text-[10px] space-y-1.5 z-20 pointer-events-none w-32 font-sans"
                              style={{ 
                                left: `${(hoveredIdxB / (metrics.timeseries.length - 1)) * 100}%`,
                                transform: hoveredIdxB > (metrics.timeseries.length / 2) ? 'translateX(-115%)' : 'translateX(15%)'
                              }}
                            >
                              <div className="text-white/40 font-mono font-medium leading-none">
                                {getPointTimestamp(hoveredIdxB)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span className="text-white/60">Standard</span>
                                <span className="font-mono font-bold ml-auto text-white">
                                  {metrics.timeseries[hoveredIdxB].classB}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* X-Axis Timeline */}
                    <div className="pl-12">
                      <div className="relative border-t border-white/[0.08] h-5 pt-1">
                        {timelineTicks.map((tick, idx) => (
                          <React.Fragment key={idx}>
                            <span 
                              className="absolute top-0 w-[1px] h-1.5 bg-white/40"
                              style={{ left: `${tick.percent}%` }}
                            />
                            <span 
                              className="absolute top-1.5 text-[9px] font-mono text-white/40 select-none whitespace-nowrap"
                              style={{ 
                                left: `${tick.percent}%`,
                                transform: tick.percent === 0 ? 'none' : tick.percent === 100 ? 'translateX(-100%)' : 'translateX(-50%)'
                              }}
                            >
                              {tick.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="text-center text-[9px] text-white/30 font-semibold font-sans tracking-wide uppercase mt-1">
                        Time (GMT+5:30)
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Settings / Config Form */}
        {activeSubTab === 'settings' && isSuperAdmin && (
          <form onSubmit={handleSaveConfig} className="space-y-4 max-w-2xl bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-5 animate-in fade-in duration-200">
            
            <div className="space-y-1 pb-2 border-b border-white/[0.04]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-accent" /> Cloudflare R2 Credentials
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Configure bucket parameters. Only **Super Administrators** have write authorization to modify variables.
              </p>
            </div>

            {!isSuperAdmin && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-400/90 leading-relaxed font-sans">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Read-only active.</strong> Your administrative account does not possess Super Admin credentials. Modifications are disabled.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">R2 Access Key ID</label>
                <input 
                  type="text" 
                  disabled={!isSuperAdmin}
                  value={config.accessKeyId}
                  onChange={e => setConfig(prev => ({ ...prev, accessKeyId: e.target.value }))}
                  placeholder="Enter Access Key ID"
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">R2 Secret Access Key</label>
                <input 
                  type="password" 
                  disabled={!isSuperAdmin}
                  value={config.secretAccessKey}
                  onChange={e => setConfig(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                  placeholder="••••••••••••••••••••••••••••"
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">S3 Compatibility Endpoint</label>
              <input 
                type="text" 
                disabled={!isSuperAdmin}
                value={config.endpoint}
                onChange={e => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Bucket Name</label>
                <input 
                  type="text" 
                  disabled={!isSuperAdmin}
                  value={config.bucketName}
                  onChange={e => setConfig(prev => ({ ...prev, bucketName: e.target.value }))}
                  placeholder="e.g. forke-assets"
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Public Domain URL</label>
                <input 
                  type="text" 
                  disabled={!isSuperAdmin}
                  value={config.publicUrl}
                  onChange={e => setConfig(prev => ({ ...prev, publicUrl: e.target.value }))}
                  placeholder="https://pub-xxxxxx.r2.dev"
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Cloudflare API Bearer Token (For GraphQL Metrics)</label>
              <input 
                type="password" 
                disabled={!isSuperAdmin}
                value={config.apiToken}
                onChange={e => setConfig(prev => ({ ...prev, apiToken: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••"
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-accent disabled:opacity-40 disabled:hover:border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-0"
              />
              <span className="text-[10px] text-white/30 leading-snug block">
                Required for real-time Class A/B request telemetry and bandwidth usage analytics.
              </span>
            </div>

            {isSuperAdmin && (
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-accent/50 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Configurations</span>
                </button>
              </div>
            )}

          </form>
        )}

        {/* Disconnected Placeholder Screen */}
        {!config.isConfigured && activeSubTab !== 'settings' && (
          <div className="flex flex-col items-center justify-center min-h-[350px] bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-8 text-center space-y-4 font-sans max-w-2xl mx-auto my-6 shadow-xl animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-sm font-semibold text-white">Cloudflare isn't connected</h4>
              <p className="text-xs text-white/40 leading-relaxed font-sans">
                Real-time metrics, operations volume, and storage telemetry require a connected Cloudflare bucket configuration.
              </p>
            </div>
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => setActiveSubTab('settings')}
                className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Configure R2 settings
              </button>
            ) : (
              <div className="text-[10px] text-white/30 bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono">
                <Lock className="w-3.5 h-3.5" />
                CONTACT SUPER ADMIN FOR CONFIGURATION
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  )
}
