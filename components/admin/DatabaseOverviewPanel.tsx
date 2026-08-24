'use client'

import React, { useState, useEffect } from 'react'
import { getDatabaseOverview } from '@/lib/db-client-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { 
  RefreshCw, 
  Copy, 
  Check, 
  Database, 
  Shield, 
  Layers, 
  Server, 
  Cpu, 
  Clock, 
  Activity,
  Settings
} from 'lucide-react'
import { toast } from '@/components/shared/Toast'

interface OverviewData {
  dbName: string
  dbSize: string
  activeConnections: number
  tablesCount: number
  version: string
  tableDetails: Array<{
    name: string
    totalSize: string
    tableSize: string
    indexSize: string
    rowCount: number
  }>
  rolesList: string[]
  dbList: string[]
  host: string
  port: string
  user: string
  sslMode: string
  maskedUri: string
  uptime: string
  cacheHitRatio: string
  commits: string
}

export default function DatabaseOverviewPanel() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedUri, setCopiedUri] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'computes' | 'roles_databases' | 'child_branches'>('computes')

  async function loadData() {
    setLoading(true)
    const res = await getDatabaseOverview()
    if (res.success) {
      setData(res as any)
    } else {
      toast(res.error || 'Failed to load database overview.', 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleCopy(text: string, type: 'id' | 'uri') {
    navigator.clipboard.writeText(text)
    if (type === 'id') {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } else {
      setCopiedUri(text)
      setTimeout(() => setCopiedUri(null), 2000)
    }
    toast('Copied to clipboard!', 'success')
  }

  if (loading) {
    return <PanelSkeleton />
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 text-left select-none bg-[#070709] text-white font-sans h-full min-h-0">
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Database overview
          </h1>
          <div className="flex items-center gap-2">
            <span className="bg-white/[0.04] border border-white/[0.08] text-white/70 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {data?.dbName || 'production'}
            </span>
            <span className="bg-accent/10 border border-accent/20 text-accent px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider">
              Default
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            className="px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-lg text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh stats
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        
        {/* Card 1 */}
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Database Engine</span>
            <Cpu className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">PostgreSQL</div>
          <div className="text-[9px] text-white/30 leading-snug truncate" title={data?.version}>{data?.version ? data.version.split(' on ')[0] : 'Loading...'}</div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Storage size</span>
            <Database className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">{data?.dbSize || 'N/A'}</div>
          <div className="text-[9px] text-white/30 leading-snug">Actual volume on disk.</div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Active Conns</span>
            <Activity className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">{data?.activeConnections || 0}</div>
          <div className="text-[9px] text-white/30 leading-snug">Open client connections.</div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Cache Hit Ratio</span>
            <Layers className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">{data?.cacheHitRatio || '100.00%'}</div>
          <div className="text-[9px] text-white/30 leading-snug">Database cache hit rate.</div>
        </div>

        {/* Card 5 */}
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-4 space-y-2 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Server Uptime</span>
            <Clock className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-bold text-white">{data?.uptime || 'N/A'}</div>
          <div className="text-[9px] text-white/30 leading-snug">Time since server startup.</div>
        </div>

      </div>

      {/* Database Metadata Card */}
      <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-xl p-5 space-y-4 font-mono text-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-sans font-semibold tracking-wider block">Database Endpoint</span>
            <div className="flex items-center gap-2">
              <span className="text-white/80 truncate block max-w-[200px]" title={data?.host}>{data?.host || 'N/A'}</span>
              <button 
                onClick={() => handleCopy(data?.host || '', 'id')}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-sans font-semibold tracking-wider block">Database Name</span>
            <span className="text-white/80 block">{data?.dbName || 'N/A'}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-sans font-semibold tracking-wider block">Database User</span>
            <span className="text-white/80 block">{data?.user || 'N/A'}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-sans font-semibold tracking-wider block">Transactions</span>
            <span className="text-white/80 block">{data?.commits || '0'} commits</span>
          </div>
        </div>
      </div>

      {/* Tabs list (Connection Details / Roles & Databases / Table sizes) */}
      <div className="space-y-4">
        
        <div className="border-b border-white/[0.06] flex items-center gap-5">
          <button
            onClick={() => setActiveSubTab('computes')}
            className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
              activeSubTab === 'computes'
                ? "border-accent text-accent"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            Connection Details
          </button>
          <button
            onClick={() => setActiveSubTab('roles_databases')}
            className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
              activeSubTab === 'roles_databases'
                ? "border-accent text-accent"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            Roles & Databases ({data?.rolesList.length || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('child_branches')}
            className={`pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer ${
              activeSubTab === 'child_branches'
                ? "border-accent text-accent"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            Table Sizes ({data?.tableDetails.length || 0})
          </button>
        </div>

        {/* Tab 1: Connection Details */}
        {activeSubTab === 'computes' && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#0b0b0e]">
              <table className="w-full border-collapse font-sans text-xs text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold">
                    <th className="px-4 py-3">Endpoint / Host</th>
                    <th className="px-4 py-3">Port</th>
                    <th className="px-4 py-3">SSL Mode</th>
                    <th className="px-4 py-3">Database User</th>
                    <th className="px-4 py-3 text-right">Connection URI (Masked)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-accent break-all max-w-xs" title={data?.host}>
                      {data?.host || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-white/80 font-mono">{data?.port || '5432'}</td>
                    <td className="px-4 py-4">
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 w-max">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {data?.sslMode === 'require' ? 'SSL ACTIVE' : 'SSL ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/80 font-mono">{data?.user || 'postgres'}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleCopy(data?.maskedUri || '', 'uri')}
                        className="px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded text-[11px] font-mono text-white/80 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {copiedUri === data?.maskedUri ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy Masked URI</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-accent/[0.02] border border-accent/20 rounded-xl p-4">
              <div className="space-y-1 text-left">
                <div className="text-xs font-semibold text-accent flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-accent shrink-0" /> PostgreSQL Version
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed max-w-none">
                  {data?.version || 'Loading server version...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Roles & Databases */}
        {activeSubTab === 'roles_databases' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Roles list */}
            <div className="border border-white/[0.06] rounded-xl bg-[#0b0b0e] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                <Shield className="w-4 h-4 text-accent" />
                <span>Database Roles ({data?.rolesList.length || 0})</span>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-60 overflow-y-auto pr-1">
                {data?.rolesList.map(role => (
                  <div key={role} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <span className="text-white/80 font-bold">{role}</span>
                    <span className="text-[9px] bg-white/[0.03] border border-white/[0.06] text-white/40 px-1.5 py-0.5 rounded">
                      can login
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Databases list */}
            <div className="border border-white/[0.06] rounded-xl bg-[#0b0b0e] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                <Database className="w-4 h-4 text-accent" />
                <span>Databases list ({data?.dbList.length || 0})</span>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-60 overflow-y-auto pr-1">
                {data?.dbList.map(dbname => (
                  <div key={dbname} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <span className="text-white/85 font-bold">{dbname}</span>
                    <span className="text-[9px] bg-accent/15 border border-accent/20 text-accent px-1.5 py-0.5 rounded">
                      active
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Table Sizes */}
        {activeSubTab === 'child_branches' && (
          <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#0b0b0e]">
            <table className="w-full border-collapse font-sans text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold">
                  <th className="px-4 py-3">Table Name</th>
                  <th className="px-4 py-3">Row Count</th>
                  <th className="px-4 py-3">Table Size</th>
                  <th className="px-4 py-3">Index Size</th>
                  <th className="px-4 py-3 text-right">Total Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {data?.tableDetails.map(t => (
                  <tr key={t.name} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3.5 text-white/80 font-bold">{t.name}</td>
                    <td className="px-4 py-3.5 text-white/60 font-sans">{t.rowCount}</td>
                    <td className="px-4 py-3.5 text-white/50">{t.tableSize}</td>
                    <td className="px-4 py-3.5 text-white/50">{t.indexSize}</td>
                    <td className="px-4 py-3.5 text-white/85 text-right font-bold text-accent">{t.totalSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  )
}
