'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getPendingOwners, 
  getApprovedOwners, 
  getDevelopers, 
  approveOwner,
  declineOwner,
  toggleOwnerBan,
  toggleDeveloperBan,
  getWaitlistConfig,
  updateWaitlistConfig,
  getSubscribers,
  deleteSubscriber,
  getCurrentAdminAction,
  getAdmins,
  inviteAdmin,
  deleteAdmin,
  updateAdminProfile,
  toggleAdminDisabledAction,
  updateAdminRoleAction,
  resetAdminPasswordAction,
  changeAdminPasswordAction,
  logSubscribersExportAction,
  getSidebarCounts
} from '@/lib/admin-dashboard-actions'
import { getEnquiries } from '@/lib/actions/support-actions'
import { adminLogout } from '@/lib/admin-actions'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import ToastContainer, { toast } from '@/components/shared/Toast'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'
import { cn } from '@/lib/utils/cn'
import { 
  LayoutDashboard,
  Users, 
  MessageSquare,
  User,
  KeyRound,
  Shield,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck, 
  UserX, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter,
  Mail,
  Phone,
  Briefcase,
  ChevronRightSquare,
  Globe,
  Settings,
  UserPlus,
  Terminal,
  Copy,
  Eye,
  EyeOff,
  Database,
  Menu,
  X,
  Activity,
  Table,
  Pencil,
  PenSquare,
  Code,
  HardDrive,
  LineChart
} from 'lucide-react'
import DatabaseConsole from '@/components/admin/DatabaseConsole'
import BlogPanel from '@/components/admin/BlogPanel'
import DatabaseOverviewPanel from '@/components/admin/DatabaseOverviewPanel'
import DatabaseMonitoringPanel from '@/components/admin/DatabaseMonitoringPanel'
import ActivityFeedPanel from '@/components/admin/ActivityFeedPanel'
import BucketsPanel from '@/components/admin/BucketsPanel'
import TrackerPanel from '@/components/admin/TrackerPanel'
import { getActivityLogLiveStatusAction } from '@/lib/actions/audit-actions'


const maskToken = (token: string) => {
  if (!token) return 'N/A'
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 8)}••••••••${token.slice(-4)}`
}

export default function AdminDashboard() {
  const router = useRouter()
  
  // Navigation states
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'owner-approval' | 'developer-ban' | 'enquiries' | 'admins' | 'subscribers' | 'tracker' | 'blogs' | 'activity' | 'database' | 'buckets' | 'db-overview' | 'db-monitoring' | 'sql-editor' | null
  >(null)
  const [usersMenuOpen, setUsersMenuOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activityLive, setActivityLive] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Sync collapsed state with localStorage to persist preferences across transitions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_sidebar_collapsed')
      if (stored === 'true') {
        setSidebarCollapsed(true)
      }
    }
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('admin_sidebar_collapsed', String(next))
      return next
    })
  }

  // Sidebar counts – fetched once on mount
  const [sidebarCounts, setSidebarCounts] = useState({
    owners: 0, pendingOwners: 0, developers: 0, subscribers: 0,
    admins: 0, enquiries: 0, blogs: 0, tables: 0, pendingSqlRequests: 0
  })


  // Keep the sidebar Activity badge in sync with the global live/paused status
  useEffect(() => {
    let active = true
    const sync = async () => {
      const res = await getActivityLogLiveStatusAction()
      if (active && res.success && typeof res.live === 'boolean') setActivityLive(res.live)
    }
    sync()
    const id = setInterval(sync, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  // Synchronize activeTab with URL query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      const validTabs = [
        'dashboard', 'owner-approval', 'developer-ban', 'enquiries',
        'admins', 'subscribers', 'tracker', 'blogs', 'activity', 'database', 'db-overview', 'db-monitoring', 'sql-editor', 'buckets'
      ]
      if (tab && validTabs.includes(tab)) {
        setActiveTab(tab as any)
      } else {
        setActiveTab('dashboard')
      }
    }
  }, [])

  // Switch tab and close the mobile drawer
  function selectTab(tab: Exclude<typeof activeTab, null>) {
    setActiveTab(tab)
    setMobileNavOpen(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.pushState({}, '', url.pathname + url.search)
    }
  }

  // Modal open states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)

  // Owners panel sub-tab
  const [ownersSubTab, setOwnersSubTab] = useState<'approved' | 'requests' | 'banned'>('approved')

  // Decline-owner modal
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false)
  const [declineTargetOwner, setDeclineTargetOwner] = useState<any>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [isDeclining, setIsDeclining] = useState(false)

  // Reusable in-app confirmation modal (replaces native confirm())
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)

  function requestConfirm(opts: ConfirmOptions) {
    setConfirmState(opts)
  }

  // Data states
  const [ownersList, setOwnersList] = useState<any[]>([])
  const [developersList, setDevelopersList] = useState<any[]>([])
  const [enquiriesList, setEnquiriesList] = useState<any[]>([])
  const [subscribersList, setSubscribersList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [isTogglingWaitlist, setIsTogglingWaitlist] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Current admin session info
  const [currentAdmin, setCurrentAdmin] = useState<any>(null)
  
  // Profile settings state
  const [profileName, setProfileName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [profileAltEmail, setProfileAltEmail] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Admins state
  const [adminsList, setAdminsList] = useState<any[]>([])
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteAltEmail, setInviteAltEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'super_admin' | 'admin'>('admin')
  const [isInviting, setIsInviting] = useState(false)

  // Password reset modal states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetTargetAdmin, setResetTargetAdmin] = useState<any>(null)
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // Edit role modal states
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false)
  const [editRoleTargetAdmin, setEditRoleTargetAdmin] = useState<any>(null)
  const [editRoleValue, setEditRoleValue] = useState<'super_admin' | 'admin'>('admin')
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  // Change Password states
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Show/Hide password toggle states
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Waitlist bypass password states
  const [waitlistBypassPassword, setWaitlistBypassPasswordState] = useState('')
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false)
  const [waitlistModalPassword, setWaitlistModalPassword] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    if (currentAdmin && currentAdmin.role !== 'super_admin' && activeTab === 'admins') {
      setActiveTab('dashboard')
      return
    }
    fetchData()
  }, [activeTab, currentAdmin])

  async function fetchData() {
    if (activeTab === null) return
    setIsLoading(true)

    // Every fetch below is independent of the others, so they run concurrently
    // instead of one-after-another — each one catches its own error so a
    // single failed fetch doesn't block the rest from loading.
    const tasks: Promise<void>[] = []

    tasks.push(
      getWaitlistConfig()
        .then((config) => {
          setWaitlistEnabled(config.enabled)
          setWaitlistBypassPasswordState(config.bypassPassword || '')
        })
        .catch((e) => console.error('Failed to fetch waitlist status:', e))
    )

    if (activeTab === 'dashboard' || activeTab === 'owner-approval') {
      tasks.push(
        Promise.all([getPendingOwners(), getApprovedOwners()])
          .then(([pending, approved]) => setOwnersList([...pending, ...approved]))
          .catch((err) => console.error('Failed to fetch owners:', err))
      )
    }
    if (activeTab === 'dashboard' || activeTab === 'developer-ban') {
      tasks.push(
        getDevelopers()
          .then((devs) => setDevelopersList(devs))
          .catch((err) => console.error('Failed to fetch developers:', err))
      )
    }
    if (activeTab === 'dashboard' || activeTab === 'enquiries') {
      tasks.push(
        getEnquiries()
          .then((res) => { if (res.success) setEnquiriesList(res.data || []) })
          .catch((err) => console.error('Failed to fetch enquiries:', err))
      )
    }
    if (activeTab === 'dashboard' || activeTab === 'subscribers') {
      tasks.push(
        getSubscribers()
          .then((res) => { if (res.success) setSubscribersList(res.data || []) })
          .catch((err) => console.error('Failed to fetch subscribers:', err))
      )
    }
    if (activeTab === 'dashboard' || activeTab === 'admins') {
      tasks.push(
        getAdmins()
          .then((res) => { if (res.success) setAdminsList(res.data || []) })
          .catch((err) => console.error('Failed to fetch admins:', err))
      )
    }

    await Promise.all(tasks)

    setIsLoading(false)

    // Silently refresh sidebar counts after data loads
    refreshSidebarCounts()
  }

  function refreshSidebarCounts() {
    getSidebarCounts()
      .then(res => {
        if (res.success && res.counts) setSidebarCounts(res.counts)
      })
      .catch(() => {})
  }

  async function fetchCurrentAdmin() {
    try {
      const res = await getCurrentAdminAction()
      if (res.success) {
        setCurrentAdmin(res.admin)
      }
    } catch (err) {
      console.error('Failed to fetch current admin:', err)
    }
  }

  useEffect(() => {
    fetchCurrentAdmin()
  }, [])

  // Fetch sidebar counts once admin is known
  useEffect(() => {
    if (!currentAdmin) return
    getSidebarCounts()
      .then(res => {
        if (res.success && res.counts) setSidebarCounts(res.counts)
      })
      .catch(err => console.error('Failed to fetch sidebar counts:', err))
  }, [currentAdmin])

  useEffect(() => {
    if (currentAdmin) {
      setProfileName(currentAdmin.name || '')
      setProfileAltEmail(currentAdmin.alternativeEmail || '')
      setProfileUsername(currentAdmin.username || '')
    }
  }, [currentAdmin])

  async function handleToggleWaitlist() {
    if (waitlistEnabled) {
      requestConfirm({
        title: 'Disable Waitlist Gate',
        message: 'This will allow open access to the site. Are you sure you want to disable the waitlist?',
        confirmLabel: 'Disable Gate',
        tone: 'danger',
        onConfirm: async () => {
          setIsTogglingWaitlist(true)
          try {
            const res = await updateWaitlistConfig(false)
            if (res.success) setWaitlistEnabled(false)
          } finally {
            setIsTogglingWaitlist(false)
          }
        },
      })
    } else {
      setWaitlistModalPassword(waitlistBypassPassword || 'bypass123')
      setIsWaitlistModalOpen(true)
    }
  }

  async function handleSaveWaitlistConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!waitlistModalPassword.trim()) {
      toast('Bypass password is required.', "error")
      return
    }
    setIsTogglingWaitlist(true)
    try {
      const res = await updateWaitlistConfig(true, waitlistModalPassword.trim())
      if (res.success) {
        setWaitlistEnabled(true)
        setWaitlistBypassPasswordState(waitlistModalPassword.trim())
        setIsWaitlistModalOpen(false)
      }
    } catch (error) {
      console.error('Failed to enable waitlist:', error)
    } finally {
      setIsTogglingWaitlist(false)
    }
  }

  async function handleApprove(userId: string) {
    try {
      await approveOwner(userId)
      fetchData()
    } catch (err) {
      console.error('Failed to approve owner:', err)
    }
  }

  async function handleDeclineOwner(e: React.FormEvent) {
    e.preventDefault()
    if (!declineTargetOwner) return
    const reason = declineReason.trim()
    if (!reason) {
      toast('Please provide a reason for declining.', "error")
      return
    }
    setIsDeclining(true)
    try {
      const res = await declineOwner(declineTargetOwner.user.id, reason)
      if (res.success) {
        toast(`${declineTargetOwner.owner.firstName}'s application was declined and they were notified.`, "success")
        setIsDeclineModalOpen(false)
        setDeclineTargetOwner(null)
        setDeclineReason('')
        fetchData()
      } else {
        toast(res.error || 'Failed to decline application.', "error")
      }
    } catch (err) {
      console.error('Failed to decline owner:', err)
      toast('Something went wrong.', "error")
    } finally {
      setIsDeclining(false)
    }
  }

  async function doToggleOwnerBan(userId: string, shouldBan: boolean) {
    try {
      await toggleOwnerBan(userId, shouldBan)
      fetchData()
    } catch (err) {
      console.error('Failed to toggle owner ban:', err)
      toast('Something went wrong.', "error")
    }
  }

  function handleToggleOwnerBan(userId: string, isBanned: boolean) {
    // Confirm only when banning; unban is safe
    if (!isBanned) {
      requestConfirm({
        title: 'Ban Owner',
        message: 'They will lose access immediately and be emailed an unban-request link. Continue?',
        confirmLabel: 'Ban Owner',
        tone: 'danger',
        onConfirm: () => doToggleOwnerBan(userId, true),
      })
    } else {
      doToggleOwnerBan(userId, false)
    }
  }

  async function doToggleBan(userId: string, shouldBan: boolean) {
    try {
      await toggleDeveloperBan(userId, shouldBan)
      fetchData()
    } catch (err) {
      console.error('Failed to toggle developer ban:', err)
      toast('Something went wrong.', "error")
    }
  }

  function handleToggleBan(userId: string, isBanned: boolean) {
    // Confirm only when banning; unban is safe
    if (!isBanned) {
      requestConfirm({
        title: 'Ban Developer',
        message: 'They will lose access immediately and be emailed an unban-request link. Continue?',
        confirmLabel: 'Ban Developer',
        tone: 'danger',
        onConfirm: () => doToggleBan(userId, true),
      })
    } else {
      doToggleBan(userId, false)
    }
  }

  async function handleLogout() {
    try {
      await adminLogout()
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  function handleDeleteSubscriber(id: string) {
    requestConfirm({
      title: 'Delete Subscriber',
      message: 'This will permanently remove this subscriber from the list. Continue?',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        const res = await deleteSubscriber(id)
        if (res.success) {
          fetchData()
        } else {
          toast('Failed to delete subscriber', "error")
        }
      },
    })
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast('Please fill in Name and Email address.', "error")
      return
    }
    setIsInviting(true)
    try {
      const res = await inviteAdmin(
        inviteName.trim(),
        inviteEmail.trim().toLowerCase(),
        inviteRole,
        inviteAltEmail.trim() || undefined
      )
      if (res.success) {
        toast('Invitation dispatched successfully!', "success")
        setIsInviteModalOpen(false)
        setInviteName('')
        setInviteEmail('')
        setInviteAltEmail('')
        setInviteRole('admin')
        fetchData()
      } else {
        toast(res.error || 'Failed to send administrative invitation.', "error")
      }
    } catch (err) {
      console.error('Invite error:', err)
      toast('Something went wrong. Please try again.', "error")
    } finally {
      setIsInviting(false)
    }
  }

  function handleDeleteAdmin(id: string) {
    requestConfirm({
      title: 'Delete Administrator',
      message: 'This will permanently remove this administrator account. Continue?',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        const res = await deleteAdmin(id)
        if (res.success) {
          fetchData()
        } else {
          toast(res.error || 'Failed to delete admin account.', "error")
        }
      },
    })
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!profileName.trim()) {
      toast('Name field cannot be left blank.', "error")
      return
    }
    if (!profileUsername.trim()) {
      toast('Username field cannot be left blank.', "error")
      return
    }
    setIsUpdatingProfile(true)
    try {
      const res = await updateAdminProfile(
        profileName.trim(),
        profileUsername.trim(),
        profileAltEmail.trim() || undefined
      )
      if (res.success) {
        toast('Administrative profile successfully updated!', "success")
        fetchCurrentAdmin()
        setIsProfileModalOpen(false)
      } else {
        toast(res.error || 'Failed to update administrative profile.', "error")
      }
    } catch (err) {
      console.error('Profile update error:', err)
      toast('Something went wrong. Please try again.', "error")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  function handleToggleDisabled(adminId: string, currentStatus: boolean) {
    const newStatus = !currentStatus
    const actionLabel = newStatus ? 'Disable' : 'Enable'
    requestConfirm({
      title: `${actionLabel} Administrator`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} this administrator?`,
      confirmLabel: actionLabel,
      tone: newStatus ? 'danger' : 'default',
      onConfirm: async () => {
        const res = await toggleAdminDisabledAction(adminId, newStatus)
        if (res.success) {
          toast(`Administrator has been successfully ${newStatus ? 'disabled' : 'enabled'}.`, "success")
          fetchData()
        } else {
          toast(res.error || 'Failed to update administrator status.', "error")
        }
      },
    })
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTargetAdmin) return
    if (!resetNewPassword || resetNewPassword.trim().length < 6) {
      toast('Password must be at least 6 characters long.', "error")
      return
    }
    setIsResetting(true)
    try {
      const res = await resetAdminPasswordAction(resetTargetAdmin.id, resetNewPassword.trim())
      if (res.success) {
        toast(`Password for ${resetTargetAdmin.name} has been successfully reset!`, "success")
        setIsResetModalOpen(false)
        setResetTargetAdmin(null)
        setResetNewPassword('')
      } else {
        toast(res.error || 'Failed to reset administrator password.', "error")
      }
    } catch (err) {
      console.error('Password reset error:', err)
      toast('Something went wrong.', "error")
    } finally {
      setIsResetting(false)
    }
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editRoleTargetAdmin) return
    if (editRoleValue === editRoleTargetAdmin.role) {
      setIsEditRoleModalOpen(false)
      return
    }
    setIsUpdatingRole(true)
    try {
      const res = await updateAdminRoleAction(editRoleTargetAdmin.id, editRoleValue)
      if (res.success) {
        toast(`${editRoleTargetAdmin.name} is now a ${editRoleValue === 'super_admin' ? 'Super Admin' : 'Admin'}.`, "success")
        setIsEditRoleModalOpen(false)
        setEditRoleTargetAdmin(null)
        fetchData()
      } else {
        toast(res.error || 'Failed to update administrator role.', "error")
      }
    } catch (err) {
      console.error('Role update error:', err)
      toast('Something went wrong.', "error")
    } finally {
      setIsUpdatingRole(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast('Please fill in all password fields.', "error")
      return
    }
    if (newPassword !== confirmPassword) {
      toast('New password and password confirmation do not match.', "error")
      return
    }
    if (newPassword.length < 6) {
      toast('New password must be at least 6 characters long.', "error")
      return
    }
    setIsChangingPassword(true)
    try {
      const res = await changeAdminPasswordAction(oldPassword, newPassword)
      if (res.success) {
        toast('Your password has been successfully changed!', "success")
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setIsChangePasswordModalOpen(false)
      } else {
        toast(res.error || 'Failed to change your password.', "error")
      }
    } catch (err) {
      console.error('Change password error:', err)
      toast('Something went wrong. Please try again.', "error")
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function handleExportCSV() {
    const headers = ['ID', 'Email', 'Source', 'Country', 'Medium', 'Campaign', 'Referrer', 'Created At']
    const rows = filteredSubscribers.map((sub) => {
      const a = (sub.attribution as Record<string, any> | null) || {}
      return [
        sub.id,
        sub.email,
        sub.source || 'direct',
        (a.country as string | null | undefined)?.toUpperCase() || '',
        a.medium || '',
        a.campaign || '',
        a.referrer || '',
        new Date(sub.createdAt).toLocaleString()
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((e) => e.map((val) => `"${val}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `forke_subscribers_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    try {
      await logSubscribersExportAction(filteredSubscribers.length)
    } catch (e) {
      console.error('Failed to log subscriber CSV export:', e)
    }
  }

  // Real-time filtering logic
  const filteredOwners = ownersList.filter(({ owner }) => {
    const fullName = `${owner.firstName} ${owner.lastName}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase()) || 
           owner.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           owner.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredDevelopers = developersList.filter((dev) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      dev.username?.toLowerCase().includes(query) ||
      dev.githubUsername?.toLowerCase().includes(query) ||
      dev.githubId?.toString().includes(query) ||
      dev.name?.toLowerCase().includes(query) ||
      dev.email?.toLowerCase().includes(query)
    )
  })

  const filteredEnquiries = enquiriesList.filter((enq) => {
    const fullName = `${enq.firstName} ${enq.lastName}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase()) || 
           enq.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
           enq.message.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredSubscribers = subscribersList.filter((sub) => {
    const q = searchQuery.toLowerCase()
    const a = (sub.attribution as Record<string, any> | null) || {}
    const country = (a.country as string | null | undefined) || ''
    return (
      sub.email.toLowerCase().includes(q) ||
      (sub.source || 'direct').toLowerCase().includes(q) ||
      country.toLowerCase().includes(q)
    )
  })

  // Signups grouped by marketing channel — sorted most → least, for the Sources breakdown card.
  const sourceBreakdown = (() => {
    const counts = new Map<string, number>()
    for (const sub of subscribersList) {
      const key = sub.source || 'direct'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  })()
  const topSourceCount = sourceBreakdown[0]?.count || 0

  const filteredAdmins = adminsList.filter((admin) => {
    return admin.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (admin.username && admin.username.toLowerCase().includes(searchQuery.toLowerCase()))
  })

  // Pagination logic and slices
  useEffect(() => {
    setCurrentPage(1)
    if (activeTab !== 'owner-approval') setOwnersSubTab('approved')
  }, [searchQuery, activeTab])

  const paginatedDevelopers = filteredDevelopers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const paginatedEnquiries = filteredEnquiries.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const paginatedSubscribers = filteredSubscribers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const paginatedAdmins = filteredAdmins.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getActiveListLength = () => {
    switch (activeTab) {
      case 'owner-approval':
        return filteredOwners.length
      case 'developer-ban':
        return filteredDevelopers.length
      case 'enquiries':
        return filteredEnquiries.length
      case 'subscribers':
        return filteredSubscribers.length
      case 'admins':
        return filteredAdmins.length
      default:
        return 0
    }
  }

  const activeListLength = getActiveListLength()
  const totalPages = Math.max(1, Math.ceil(activeListLength / pageSize))

  function renderPagination() {
    if (activeListLength === 0) return null

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-white/[0.005] text-left">
        {/* Info label */}
        <p className="text-[11px] text-[var(--color-text-muted)] font-medium font-mono">
          Showing <span className="text-white">{(currentPage - 1) * pageSize + 1}</span> – <span className="text-white">{Math.min(currentPage * pageSize, activeListLength)}</span> of <span className="text-white">{activeListLength}</span>
        </p>

        <div className="flex items-center gap-4">
          {/* Rows selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">Rows</span>
            <Select
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v))
                setCurrentPage(1)
              }}
              size="sm"
              align="right"
              placement="top"
              className="w-16"
              options={[5, 10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium text-white px-2 font-mono select-none">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === null) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex">
        {/* Sidebar skeleton */}
        <div className="hidden md:flex w-60 border-r border-white/[0.06] flex-col p-4 gap-2 shrink-0">
          <Skeleton className="h-8 w-36 mb-4" />
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex-grow p-6 md:p-8 space-y-6 max-w-6xl">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white flex">

      {/* --- MOBILE NAV BACKDROP --- */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside className={cn(
        "border-r border-[var(--color-border)] bg-[#070709] shrink-0 flex flex-col justify-between h-screen fixed lg:sticky top-0 left-0 z-50 transition-all duration-300 select-none",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64",
        mobileNavOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex-grow flex flex-col overflow-y-auto pt-4 min-h-0">
          
          {/* Logo & Header */}
          <div className={cn(
            "h-14 flex items-center border-b border-[var(--color-border)] mb-4 shrink-0 px-5 gap-2.5 transition-all duration-300",
            sidebarCollapsed && "lg:px-0 lg:justify-center"
          )}>
            {sidebarCollapsed ? (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <div className="w-6 h-6 relative flex items-center shrink-0">
                  <img 
                    src="/forke-assets/forke_logo.png" 
                    alt="Forke Logo" 
                    className="absolute -left-3 -top-3 w-12 h-12 max-w-none object-contain"
                  />
                </div>
                <span className="font-bold text-xs uppercase tracking-[0.2em] text-white whitespace-nowrap animate-in fade-in duration-200">
                  ADMIN PANEL
                </span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer ml-auto"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleSidebar}
                  className="hidden lg:flex p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer ml-auto"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-grow px-3 space-y-0.5">
            
            {/* Dashboard */}
            <button
              onClick={() => selectTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'dashboard'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Overview" : undefined}
            >
              <LayoutDashboard className={cn(
                `w-[18px] h-[18px] shrink-0 transition-colors`,
                activeTab === 'dashboard' ? 'text-accent' : 'text-[var(--color-text-muted)]'
              )} />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Overview</span>}
            </button>

            {/* Users */}
            {!sidebarCollapsed ? (
              <div className="space-y-0.5">
                <button
                  onClick={() => setUsersMenuOpen(!usersMenuOpen)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left ${
                    activeTab === 'owner-approval' || activeTab === 'developer-ban'
                      ? 'text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-[18px] h-[18px] shrink-0 text-[var(--color-text-muted)]" />
                    <span>Users</span>
                  </div>
                  {usersMenuOpen ? <ChevronDown className="w-4 h-4 text-white/20" /> : <ChevronRight className="w-4 h-4 text-white/20" />}
                </button>

                {usersMenuOpen && (
                  <div className="pl-6 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <button
                      onClick={() => selectTab('owner-approval')}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                        activeTab === 'owner-approval'
                          ? 'text-accent font-semibold bg-accent/[0.04]'
                          : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <span>Owners</span>
                      {sidebarCounts.pendingOwners > 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent/15 border border-accent/25 text-accent leading-none">
                          {sidebarCounts.pendingOwners}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-white/25 leading-none">
                          {sidebarCounts.owners}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => selectTab('developer-ban')}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                        activeTab === 'developer-ban'
                          ? 'text-accent font-semibold bg-accent/[0.04]'
                          : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <span>Developers</span>
                      <span className="text-[10px] font-mono text-white/25 leading-none">
                        {sidebarCounts.developers}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Owners (as standalone icon when collapsed) */}
                <button
                  onClick={() => selectTab('owner-approval')}
                  className={cn(
                    "w-full flex items-center justify-center py-2 rounded-lg transition-colors text-[13px] font-medium relative",
                    activeTab === 'owner-approval'
                      ? 'bg-white/[0.05] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
                  )}
                  title="Owners"
                >
                  <Briefcase className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-colors",
                    activeTab === 'owner-approval' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                  )} />
                  {sidebarCounts.pendingOwners > 0 && (
                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
                  )}
                </button>

                {/* Developers (as standalone icon when collapsed) */}
                <button
                  onClick={() => selectTab('developer-ban')}
                  className={cn(
                    "w-full flex items-center justify-center py-2 rounded-lg transition-colors text-[13px] font-medium",
                    activeTab === 'developer-ban'
                      ? 'bg-white/[0.05] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
                  )}
                  title="Developers"
                >
                  <Code className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-colors",
                    activeTab === 'developer-ban' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                  )} />
                </button>
              </>
            )}

            {/* Enquiries */}
            <button
              onClick={() => selectTab('enquiries')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'enquiries'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Enquiries" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'enquiries' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Enquiries</span>}
              </div>
              {!sidebarCollapsed && (
                sidebarCounts.enquiries > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent/15 border border-accent/25 text-accent leading-none">
                    {sidebarCounts.enquiries}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-white/25 leading-none">0</span>
                )
              )}
              {sidebarCollapsed && sidebarCounts.enquiries > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>

            {/* Subscribers */}
            <button
              onClick={() => selectTab('subscribers')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'subscribers'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Subscribers" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Mail className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'subscribers' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Subscribers</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-mono text-white/25 leading-none">
                  {sidebarCounts.subscribers}
                </span>
              )}
            </button>

            {/* Tracker */}
            <button
              onClick={() => selectTab('tracker')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'tracker'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Tracker" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <LineChart className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'tracker' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Tracker</span>}
              </div>
            </button>

            {/* Blog */}
            <button
              onClick={() => selectTab('blogs')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'blogs'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Blog" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <PenSquare className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'blogs' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Blog</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-mono text-white/25 leading-none">
                  {sidebarCounts.blogs}
                </span>
              )}
            </button>

            {/* Activity / audit log */}
            <button
              onClick={() => selectTab('activity')}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'activity'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Activity" : undefined}
            >
              <Terminal className={cn(
                `w-[18px] h-[18px] shrink-0 transition-colors`,
                activeTab === 'activity' ? 'text-accent' : 'text-[var(--color-text-muted)]'
              )} />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Activity</span>}
              {!sidebarCollapsed && (
                <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-mono rounded border leading-none ${
                  activityLive
                    ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                    : 'bg-white/[0.04] border-white/15 text-white/40'
                }`}>
                  {activityLive ? 'Live' : 'Paused'}
                </span>
              )}
              {sidebarCollapsed && (
                <span className={cn(
                  "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
                  activityLive ? "bg-emerald-400" : "bg-white/20"
                )} />
              )}
            </button>

            {/* Database Section */}
            {!sidebarCollapsed ? (
              <div className="pt-3 pb-1.5 px-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  Database Console
                </span>
              </div>
            ) : (
              <div className="h-[1px] bg-[var(--color-border)] my-2" />
            )}

            {/* Overview */}
            <button
              onClick={() => selectTab('db-overview')}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'db-overview'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "DB Overview" : undefined}
            >
              <Globe className={cn(
                `w-[18px] h-[18px] shrink-0 transition-colors`,
                activeTab === 'db-overview' ? 'text-accent' : 'text-[var(--color-text-muted)]'
              )} />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Overview</span>}
            </button>

            {/* Monitoring */}
            <button
              onClick={() => selectTab('db-monitoring')}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'db-monitoring'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "DB Monitoring" : undefined}
            >
              <Activity className={cn(
                `w-[18px] h-[18px] shrink-0 transition-colors`,
                activeTab === 'db-monitoring' ? 'text-accent' : 'text-[var(--color-text-muted)]'
              )} />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Monitoring</span>}
            </button>


            {/* Tables */}
            <button
              onClick={() => selectTab('database')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'database'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Tables" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Table className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'database' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Tables</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-mono text-white/25 leading-none">
                  {sidebarCounts.tables}
                </span>
              )}
            </button>

            {/* Buckets */}
            <button
              onClick={() => selectTab('buckets')}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                activeTab === 'buckets'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
              )}
              title={sidebarCollapsed ? "Buckets" : undefined}
            >
              <div className="flex items-center gap-2.5">
                <HardDrive className={cn(
                  `w-[18px] h-[18px] shrink-0 transition-colors`,
                  activeTab === 'buckets' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                )} />
                {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Buckets</span>}
              </div>
            </button>

            {/* SQL Editor */}
            {currentAdmin && (
              <button
                onClick={() => selectTab('sql-editor')}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                  activeTab === 'sql-editor'
                    ? 'bg-white/[0.05] text-white'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
                )}
                title={sidebarCollapsed ? "SQL Editor" : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className={cn(
                    `w-[18px] h-[18px] shrink-0 transition-colors`,
                    activeTab === 'sql-editor' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                  )} />
                  {!sidebarCollapsed && <span className="animate-in fade-in duration-200">SQL Editor</span>}
                </div>
                {!sidebarCollapsed && currentAdmin?.role === 'super_admin' && sidebarCounts.pendingSqlRequests > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent/15 border border-accent/25 text-accent leading-none">
                    {sidebarCounts.pendingSqlRequests}
                  </span>
                )}
                {sidebarCollapsed && currentAdmin?.role === 'super_admin' && sidebarCounts.pendingSqlRequests > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            )}

            {/* Admins */}
            {currentAdmin?.role === 'super_admin' && (
              <button
                onClick={() => selectTab('admins')}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-[13px] font-medium text-left relative",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                  activeTab === 'admins'
                    ? 'bg-white/[0.05] text-white'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white'
                )}
                title={sidebarCollapsed ? "Admins" : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className={cn(
                    `w-[18px] h-[18px] shrink-0 transition-colors`,
                    activeTab === 'admins' ? 'text-accent' : 'text-[var(--color-text-muted)]'
                  )} />
                  {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Admins</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] font-mono text-white/25 leading-none">
                    {sidebarCounts.admins}
                  </span>
                )}
              </button>
            )}

            <div className="h-[1px] bg-[var(--color-border)] my-2" />

            {/* Profile */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white transition-colors text-left cursor-pointer",
                sidebarCollapsed && "lg:justify-center lg:px-0"
              )}
              title={sidebarCollapsed ? "Profile" : undefined}
            >
              <User className="w-[18px] h-[18px] shrink-0" />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Profile</span>}
            </button>

            {/* Change Password */}
            <button
              onClick={() => setIsChangePasswordModalOpen(true)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-white transition-colors text-left cursor-pointer",
                sidebarCollapsed && "lg:justify-center lg:px-0"
              )}
              title={sidebarCollapsed ? "Change Password" : undefined}
            >
              <KeyRound className="w-[18px] h-[18px] shrink-0" />
              {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Change Password</span>}
            </button>

          </nav>
        </div>

        {/* User Card & Logout at bottom */}
        <div className={cn(
          "p-3 border-t border-[var(--color-border)] flex flex-col gap-2 shrink-0 transition-all duration-300",
          sidebarCollapsed && "lg:items-center lg:px-0"
        )}>
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] w-full transition-all duration-300",
            sidebarCollapsed && "lg:p-0 lg:bg-transparent lg:justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent text-xs shrink-0">
              {currentAdmin?.name
                ? currentAdmin.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                : 'SA'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-grow text-left truncate animate-in fade-in duration-200">
                <h4 className="text-[13px] font-medium text-white truncate leading-none">
                  {currentAdmin?.name || 'Super Admin'}
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-1">
                  {currentAdmin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout} 
            className={cn(
              "flex items-center gap-2 px-2 py-2 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-red-400 transition-colors cursor-pointer w-full",
              sidebarCollapsed && "justify-center px-0"
            )}
            title={sidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="animate-in fade-in duration-200">Sign Out</span>}
          </button>
        </div>

      </aside>

      {/* --- MAIN PAGE CONTENT --- */}
      <main className="flex-grow h-screen overflow-hidden bg-[#0b0b0e] flex flex-col text-left">
        
        {/* --- HEADER (mobile only — desktop uses sidebar for context) --- */}
        <header className="lg:hidden h-14 px-4 sm:px-6 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-medium text-white tracking-tight capitalize truncate">
              {activeTab === 'owner-approval'
                ? 'Owners'
                : activeTab === 'developer-ban'
                ? 'Developers'
                : activeTab}
            </h1>
          </div>
        </header>

        {/* --- DYNAMIC BODY VIEWS --- */}
        <div className="flex-grow min-h-0 w-full flex flex-col p-4 sm:p-6 lg:p-8">

          {/* ==================== DASHBOARD PANEL ==================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 overflow-y-auto flex-grow min-h-0 pr-1">
              
              {/* Waitlist Control Card */}
              <div className="p-6 rounded-xl bg-white/[0.018] border border-[var(--color-border)]">
                <div className="flex flex-row items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm font-medium text-white truncate">Waitlist Access Control</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate sm:not-truncate">Manage signup restrictions and bypass codes</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                    <span className={`w-2 h-2 rounded-full ${
                      waitlistEnabled ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-white/15'
                    }`} />
                    <span className="text-xs font-medium text-white whitespace-nowrap">{waitlistEnabled ? 'Gate Enabled' : 'Gate Disabled'}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    {waitlistEnabled && waitlistBypassPassword && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-muted)] font-mono">Bypass Key:</span>
                        <span className="text-white border border-[var(--color-border)] bg-white/[0.02] px-2 py-0.5 rounded font-bold font-mono text-xs">{waitlistBypassPassword}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(waitlistBypassPassword)
                            const btnId = `copied-bypass`
                            const el = document.getElementById(btnId)
                            if (el) {
                              el.classList.remove('opacity-0')
                              el.classList.add('opacity-100')
                              setTimeout(() => {
                                el.classList.remove('opacity-100')
                                el.classList.add('opacity-0')
                              }, 2000)
                            }
                          }}
                          className="p-1.5 rounded-lg bg-white/[0.02] border border-[var(--color-border)] hover:bg-white/[0.06] hover:border-white/10 transition-colors text-white/40 hover:text-white inline-flex items-center justify-center cursor-pointer"
                          title="Copy Bypass Key"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <span id="copied-bypass" className="text-[10px] text-emerald-400 font-mono opacity-0 transition-opacity duration-300">
                          Copied!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {waitlistEnabled && (
                      <button
                        onClick={() => {
                          setWaitlistModalPassword(waitlistBypassPassword)
                          setIsWaitlistModalOpen(true)
                        }}
                        className="h-8 px-3 rounded-lg text-[13px] transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                      >
                        Change Bypass Key
                      </button>
                    )}
                    <button
                      onClick={handleToggleWaitlist}
                      disabled={isTogglingWaitlist}
                      className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                        waitlistEnabled
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                      }`}
                    >
                      {isTogglingWaitlist ? 'Saving...' : (waitlistEnabled ? 'Disable Gate' : 'Enable Gate')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Owners */}
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.018] flex flex-col justify-between min-h-[100px]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
                    <span>Total Clients</span>
                    <Briefcase className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-left mt-3">
                    <h3 className="text-2xl font-medium text-white tracking-tight font-mono leading-none">
                      {sidebarCounts.owners}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                      {sidebarCounts.pendingOwners > 0 ? (
                        <span className="text-orange-400">{sidebarCounts.pendingOwners} pending approval</span>
                      ) : 'All approved'}
                    </p>
                  </div>
                </div>

                {/* Total Devs */}
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.018] flex flex-col justify-between min-h-[100px]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
                    <span>Total Developers</span>
                    <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-left mt-3">
                    <h3 className="text-2xl font-medium text-white tracking-tight font-mono leading-none">
                      {sidebarCounts.developers}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">Registered builders</p>
                  </div>
                </div>

                {/* Total Enquiries */}
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.018] flex flex-col justify-between min-h-[100px]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
                    <span>Pending Support</span>
                    <MessageSquare className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-left mt-3">
                    <h3 className="text-2xl font-medium text-white tracking-tight font-mono leading-none">
                      {sidebarCounts.enquiries}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">Support & conflict tickets</p>
                  </div>
                </div>

                {/* Total Subscribers */}
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.018] flex flex-col justify-between min-h-[100px]">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
                    <span>Total Subscribers</span>
                    <Mail className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-left mt-3">
                    <h3 className="text-2xl font-medium text-white tracking-tight font-mono leading-none">
                      {sidebarCounts.subscribers}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">Waitlist signups</p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== OWNERS PANEL ==================== */}
          {activeTab === 'owner-approval' && (() => {
            const pendingOwners = filteredOwners.filter(({ user }) => !user.isApproved)
            const approvedOwners = filteredOwners.filter(({ user }) => user.isApproved && !user.isBanned)
            const bannedOwners = filteredOwners.filter(({ user }) => user.isApproved && user.isBanned)
            const activeOwners =
              ownersSubTab === 'requests' ? pendingOwners
              : ownersSubTab === 'banned' ? bannedOwners
              : approvedOwners
            const paginatedActive = activeOwners.slice((currentPage - 1) * pageSize, currentPage * pageSize)

            // Unfiltered totals for the tab count badges
            const totalApproved = ownersList.filter(({ user }) => user.isApproved && !user.isBanned).length
            const totalRequests = ownersList.filter(({ user }) => !user.isApproved).length
            const totalBanned = ownersList.filter(({ user }) => user.isApproved && user.isBanned).length

            return (
              <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">

                {/* Sub-tab switcher + search */}
                <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center gap-3 bg-white/[0.005]">
                  <div className="flex items-center gap-1 bg-white/[0.03] border border-[var(--color-border)] rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => { setOwnersSubTab('approved'); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        ownersSubTab === 'approved'
                          ? 'bg-white/[0.08] text-white'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      Approved
                      <span className={`ml-1.5 text-[10px] font-mono ${ownersSubTab === 'approved' ? 'text-white/60' : 'text-white/25'}`}>
                        {totalApproved}
                      </span>
                    </button>
                    <button
                      onClick={() => { setOwnersSubTab('requests'); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        ownersSubTab === 'requests'
                          ? 'bg-white/[0.08] text-white'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      Requests
                      {totalRequests > 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 leading-none">
                          {totalRequests}
                        </span>
                      ) : (
                        <span className={`text-[10px] font-mono ${ownersSubTab === 'requests' ? 'text-white/60' : 'text-white/25'}`}>0</span>
                      )}
                    </button>
                    <button
                      onClick={() => { setOwnersSubTab('banned'); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        ownersSubTab === 'banned'
                          ? 'bg-white/[0.08] text-white'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      Banned
                      {totalBanned > 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-500/15 border border-red-500/25 text-red-400 leading-none">
                          {totalBanned}
                        </span>
                      ) : (
                        <span className={`text-[10px] font-mono ${ownersSubTab === 'banned' ? 'text-white/60' : 'text-white/25'}`}>0</span>
                      )}
                    </button>
                  </div>

                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search by name, company, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-auto flex-grow min-h-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-white/[0.01]">
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">User Details</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Company / Designation</th>
                        {ownersSubTab !== 'requests' && (
                          <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                        )}
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/50">
                      {isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">Loading records...</td>
                        </tr>
                      ) : activeOwners.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">
                            {ownersSubTab === 'requests'
                              ? 'No pending requests'
                              : ownersSubTab === 'banned'
                              ? 'No banned owners'
                              : 'No matching records found'}
                          </td>
                        </tr>
                      ) : (
                        paginatedActive.map(({ user, owner }) => (
                          <tr key={user.id} className="group hover:bg-white/[0.005] transition-colors border-b border-[var(--color-border)]/50 last:border-b-0">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/5 border border-[var(--color-border)] overflow-hidden relative shrink-0">
                                  {user.image && <img src={user.image} alt={user.name} className="object-cover w-full h-full" />}
                                </div>
                                <div>
                                  {user.username ? (
                                    <a
                                      href={`/${user.username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-white text-sm hover:text-accent transition-colors"
                                      title={`View @${user.username}'s profile`}
                                    >
                                      {owner.firstName} {owner.lastName}
                                      <span className="text-xs text-accent ml-1.5">@{user.username}</span>
                                    </a>
                                  ) : (
                                    <p className="font-medium text-white text-sm">{owner.firstName} {owner.lastName}</p>
                                  )}
                                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-1">
                                    <span>{owner.contactEmail}</span>
                                    {owner.contactNumber && <span>&middot; {owner.contactNumber}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[13px] text-[var(--color-text-muted)]">
                              <div>
                                <p className="font-medium text-white/80">{owner.companyName}</p>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">{owner.designation}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <a href={owner.personalLinkedIn} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">LinkedIn</a>
                                  {owner.companyWebsite && <a href={owner.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">Website</a>}
                                </div>
                              </div>
                            </td>
                            {ownersSubTab !== 'requests' && (
                              <td className="px-6 py-4">
                                {ownersSubTab === 'banned' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                    <UserX className="w-3.5 h-3.5" /> Banned
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {ownersSubTab === 'requests' && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(user.id)}
                                      className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                                      title="Approve Owner"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeclineTargetOwner({ user, owner })
                                        setDeclineReason('')
                                        setIsDeclineModalOpen(true)
                                      }}
                                      className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                      title="Decline with Reason"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {ownersSubTab === 'approved' && (
                                  <button
                                    onClick={() => handleToggleOwnerBan(user.id, false)}
                                    className="h-8 px-3 rounded-lg text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                    title="Ban Owner"
                                  >
                                    Ban
                                  </button>
                                )}
                                {ownersSubTab === 'banned' && (
                                  <button
                                    onClick={() => handleToggleOwnerBan(user.id, true)}
                                    className="h-8 px-3 rounded-lg text-xs font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                                    title="Unban Owner"
                                  >
                                    Unban
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {activeOwners.length > pageSize && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-white/[0.005] text-left">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-medium font-mono">
                      Showing <span className="text-white">{(currentPage - 1) * pageSize + 1}</span> – <span className="text-white">{Math.min(currentPage * pageSize, activeOwners.length)}</span> of <span className="text-white">{activeOwners.length}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-medium text-white px-2 font-mono select-none">
                        {currentPage} / {Math.ceil(activeOwners.length / pageSize)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(activeOwners.length / pageSize)))}
                        disabled={currentPage === Math.ceil(activeOwners.length / pageSize)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-white/15 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )
          })()}

          {/* ==================== DEVELOPERS PANEL ==================== */}
          {activeTab === 'developer-ban' && (
            <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">
              
              {/* Search */}
              <div className="p-4 border-b border-[var(--color-border)] bg-white/[0.005]">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input 
                    type="text" 
                    placeholder="Search by username or GitHub ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Table list */}
              <div className="overflow-auto flex-grow min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-white/[0.01]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Developer</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">GitHub ID</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Access Token</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Joined Date</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">Loading records...</td>
                      </tr>
                    ) : filteredDevelopers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">No matching records found</td>
                      </tr>
                    ) : (
                      paginatedDevelopers.map((dev) => (
                        <tr key={dev.id} className="group hover:bg-white/[0.005] transition-colors border-b border-[var(--color-border)]/50 last:border-b-0">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white/5 border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden relative">
                                {dev.image ? (
                                  <img src={dev.image} alt={dev.name || dev.username} className="object-cover w-full h-full" />
                                ) : (
                                  <Terminal className="w-4 h-4 text-white/60" />
                                )}
                              </div>
                              <div>
                                {dev.forkeUsername ? (
                                  <a
                                    href={`/${dev.forkeUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-white hover:text-accent transition-colors block text-sm"
                                    title={`View @${dev.forkeUsername}'s Forke profile`}
                                  >
                                    {dev.name || dev.forkeUsername}
                                    <span className="text-xs text-accent ml-1.5">@{dev.forkeUsername}</span>
                                  </a>
                                ) : (
                                  <p className="font-medium text-white text-sm">{dev.name || 'N/A'}</p>
                                )}
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                  {dev.email || 'No Email Linked'}
                                  {dev.username && <> &middot; <a href={`https://github.com/${dev.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">@{dev.username} (GitHub)</a></>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)]">
                            <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-[var(--color-border)]">
                              {dev.githubId || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[13px] text-[var(--color-text-muted)]">
                            {dev.accessToken ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[var(--color-text-muted)]">
                                  {maskToken(dev.accessToken)}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(dev.accessToken)
                                    const btnId = `copied-${dev.id}`
                                    const el = document.getElementById(btnId)
                                    if (el) {
                                      el.classList.remove('opacity-0')
                                      el.classList.add('opacity-100')
                                      setTimeout(() => {
                                        el.classList.remove('opacity-100')
                                        el.classList.add('opacity-0')
                                      }, 2000)
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-white/[0.02] border border-[var(--color-border)] hover:bg-white/[0.06] hover:border-white/10 transition-colors text-white/40 hover:text-white"
                                  title="Copy Access Token"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <span id={`copied-${dev.id}`} className="text-[10px] text-emerald-400 font-mono opacity-0 transition-opacity duration-300">
                                  Copied!
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-white/20 italic">No Access Token</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)]">
                            <span>
                              {dev.createdAt ? new Date(dev.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {!dev.userId ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                                <Terminal className="w-3 h-3" /> Unlinked
                              </span>
                            ) : dev.isBanned ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                <UserX className="w-3 h-3" /> Banned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {dev.userId ? (
                              <button 
                                onClick={() => handleToggleBan(dev.userId, dev.isBanned)}
                                className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                  dev.isBanned 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white' 
                                    : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                                }`}
                              >
                                {dev.isBanned ? 'Unban' : 'Ban'}
                              </button>
                            ) : (
                              <span className="text-xs text-white/20 italic">No Action Needed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {renderPagination()}

            </div>
          )}

          {/* ==================== ENQUIRIES PANEL ==================== */}
          {activeTab === 'enquiries' && (
            <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">
              
              {/* Search */}
              <div className="p-4 border-b border-[var(--color-border)] bg-white/[0.005]">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input 
                    type="text" 
                    placeholder="Search enquiries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-grow min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-white/[0.01]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Contact Info</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Message Details</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Issue Category</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">Loading records...</td>
                      </tr>
                    ) : filteredEnquiries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">No matching records found</td>
                      </tr>
                    ) : (
                      paginatedEnquiries.map((enq) => (
                        <tr key={enq.id} className="group hover:bg-white/[0.005] transition-colors border-b border-[var(--color-border)]/50 last:border-b-0">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-white text-sm">{enq.firstName} {enq.lastName}</p>
                              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-1">
                                <span>{enq.contactEmail}</span>
                                <span>&middot; {enq.contactNumber}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-sm">
                            <p className="text-[13px] text-white/70 line-clamp-3 leading-relaxed" title={enq.message}>
                              {enq.message}
                            </p>
                            {enq.relevantLinks && (
                              <a href={enq.relevantLinks} target="_blank" rel="noopener noreferrer" className="text-xs text-accent mt-2 inline-block hover:underline">
                                View Attached Link
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.03] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-medium">
                              {enq.errorType === 'AccessDenied' 
                                ? 'USER BAN' 
                                : enq.errorType === 'GitHubIdentityMismatch' 
                                ? 'GITHUB CONFLICT' 
                                : enq.errorType || 'GENERAL'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)]">
                            <p>{new Date(enq.createdAt).toLocaleDateString()}</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {renderPagination()}

            </div>
          )}

          {/* ==================== SUBSCRIBERS PANEL ==================== */}
          {activeTab === 'subscribers' && (
            <div className="flex flex-col min-h-0 flex-grow gap-4 overflow-y-auto pr-1">

            {/* Sources breakdown — where signups are coming from */}
            {!isLoading && sourceBreakdown.length > 0 && (
              <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-5 shrink-0">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white">Signup Sources</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Tag your shared links with <span className="font-mono text-white/70">?source=twitter</span> to see which channels convert.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
                    {subscribersList.length} total
                  </span>
                </div>
                <div className="space-y-2.5">
                  {sourceBreakdown.map(({ source, count }) => {
                    const pct = subscribersList.length > 0 ? Math.round((count / subscribersList.length) * 100) : 0
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs font-mono text-white/70 truncate" title={source}>{source}</span>
                        <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${topSourceCount > 0 ? (count / topSourceCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs font-mono text-white/80">
                          {count} <span className="text-[var(--color-text-muted)]">({pct}%)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">

              {/* Search & Action Buttons */}
              <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between bg-white/[0.005] gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input 
                    type="text" 
                    placeholder="Search subscribers by email, source or country..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportCSV}
                    className="h-8 px-3 rounded-lg text-[13px] transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] flex items-center gap-2 cursor-pointer font-medium"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-grow min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-white/[0.01]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Subscriber ID</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Email Address</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Source</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Country</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Date & Time Joined</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">Loading records...</td>
                      </tr>
                    ) : filteredSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">No matching records found</td>
                      </tr>
                    ) : (
                      paginatedSubscribers.map((sub) => {
                        const a = sub.attribution as Record<string, any> | null
                        const country = a?.country as string | null | undefined
                        return (
                          <tr key={sub.id} className="group hover:bg-white/[0.005] transition-colors border-b border-[var(--color-border)]/50 last:border-b-0">
                            <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                              <p>{sub.id}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm font-medium text-white">{sub.email}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium font-mono bg-white/[0.04] border border-[var(--color-border)] text-white/70">
                                {sub.source || 'direct'}
                              </span>
                              {(() => {
                                // Skip detail parts that just repeat the source badge above
                                // (e.g. source "organic" with medium "organic").
                                const shown = (sub.source || 'direct').toLowerCase()
                                const detail = a
                                  ? [a.medium, a.campaign]
                                      .filter((v) => v && String(v).toLowerCase() !== shown)
                                      .join(' · ')
                                  : ''
                                return detail ? (
                                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1" title={a?.referrer || undefined}>{detail}</p>
                                ) : null
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {country ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white/70">
                                  <Globe className="w-3 h-3 text-[var(--color-text-muted)]" />
                                  {country.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-xs font-mono text-white/25">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                              <p>{new Date(sub.createdAt).toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteSubscriber(sub.id)}
                                className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                title="Delete Subscriber"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {renderPagination()}

            </div>
            </div>
          )}

          {/* ==================== ADMINS PANEL ==================== */}
          {activeTab === 'admins' && (
            <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">
              
              {/* Search & Action Buttons */}
              <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between bg-white/[0.005] gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input 
                    type="text" 
                    placeholder="Search administrators by name, email or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {currentAdmin?.role === 'super_admin' && (
                    <button 
                      onClick={() => setIsInviteModalOpen(true)}
                      className="h-8 px-3 rounded-lg text-[13px] ui-btn-primary transition-colors flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <UserPlus className="w-4 h-4 text-black" /> Invite Admin
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-grow min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-white/[0.01]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Administrative Profile</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Email / Credentials</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Access Level</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Last Login</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Status</th>
                      {currentAdmin?.role === 'super_admin' && (
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">Loading records...</td>
                      </tr>
                    ) : filteredAdmins.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">No matching records found</td>
                      </tr>
                    ) : (
                      paginatedAdmins.map((adm) => (
                        <tr key={adm.id} className={`group hover:bg-white/[0.005] transition-colors border-b border-[var(--color-border)]/50 last:border-b-0 ${adm.isDisabled ? 'opacity-40' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-white text-sm">{adm.name}</p>
                              {adm.alternativeEmail && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                  Alt: {adm.alternativeEmail}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="font-mono text-xs text-[var(--color-text-muted)]">{adm.email}</p>
                              {adm.username ? (
                                <p className="text-xs text-accent mt-1">
                                  @{adm.username}
                                </p>
                              ) : (
                                <p className="text-xs text-white/20 mt-1 italic">
                                  No username set yet
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              adm.role === 'super_admin' 
                                ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' 
                                : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            }`}>
                              {adm.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                            {adm.lastLoginAt ? (
                              <p className="whitespace-nowrap">
                                {new Date(adm.lastLoginAt).toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-white/20 italic whitespace-nowrap">
                                Never logged in
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {adm.isDisabled ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                <UserX className="w-3 h-3" /> Disabled
                              </span>
                            ) : adm.username ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium animate-pulse">
                                <ShieldCheck className="w-3.5 h-3.5" /> Pending Setup
                              </span>
                            )}
                          </td>
                          {currentAdmin?.role === 'super_admin' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {currentAdmin.id !== adm.id ? (
                                <div className="flex items-center gap-2">
                                  {/* Toggle Disable/Enable */}
                                  <button
                                    onClick={() => handleToggleDisabled(adm.id, adm.isDisabled)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                      adm.isDisabled 
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white' 
                                        : 'bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white'
                                    }`}
                                    title={adm.isDisabled ? 'Enable Account' : 'Disable Account'}
                                  >
                                    {adm.isDisabled ? <CheckCircle2 className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                  </button>

                                  {/* Edit Role */}
                                  <button
                                    onClick={() => {
                                      setEditRoleTargetAdmin(adm)
                                      setEditRoleValue(adm.role)
                                      setIsEditRoleModalOpen(true)
                                    }}
                                    className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors cursor-pointer"
                                    title="Edit Access Role"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  {/* Reset Password */}
                                  <button
                                    onClick={() => {
                                      setResetTargetAdmin(adm)
                                      setIsResetModalOpen(true)
                                    }}
                                    className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
                                    title="Reset Password Override"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>

                                  {/* Delete Account */}
                                  <button 
                                    onClick={() => handleDeleteAdmin(adm.id)}
                                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <UserX className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-white/20 italic whitespace-nowrap">Logged In</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==================== BLOG PANEL ==================== */}
          {activeTab === 'blogs' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <BlogPanel />
            </div>
          )}

          {/* ==================== ACTIVITY / AUDIT LOG PANEL ==================== */}
          {activeTab === 'activity' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <ActivityFeedPanel currentAdmin={currentAdmin} />
            </div>
          )}

          {/* ==================== TRACKER PANEL ==================== */}
          {activeTab === 'tracker' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <TrackerPanel />
            </div>
          )}

          {/* ==================== DATABASE OVERVIEW PANEL ==================== */}
          {activeTab === 'db-overview' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <DatabaseOverviewPanel />
            </div>
          )}

          {/* ==================== DATABASE MONITORING PANEL ==================== */}
          {activeTab === 'db-monitoring' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <DatabaseMonitoringPanel />
            </div>
          )}



          {/* ==================== DATABASE TABLES PANEL ==================== */}
          {activeTab === 'database' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <DatabaseConsole currentAdmin={currentAdmin} />
            </div>
          )}

          {/* ==================== BUCKETS PANEL ==================== */}
          {activeTab === 'buckets' && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <BucketsPanel currentAdmin={currentAdmin} />
            </div>
          )}

          {/* ==================== SQL EDITOR PANEL ==================== */}
          {activeTab === 'sql-editor' && currentAdmin && (
            <div className="flex-grow min-h-0 h-full flex flex-col">
              <DatabaseConsole currentAdmin={currentAdmin} initialTab="sql" />
            </div>
          )}

        </div>

      </main>

      {/* --- INVITE ADMIN GLASS MODAL --- */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Invite Administrator</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  An invitation email will request them to complete onboarding and select credentials.
                </p>
              </div>

              <form onSubmit={handleInviteAdmin} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="E.g., John Doe"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Email Address</label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="e.g. john@forke.space"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Alternative Email (Optional)</label>
                    <input
                      type="email"
                      value={inviteAltEmail}
                      onChange={(e) => setInviteAltEmail(e.target.value)}
                      placeholder="Alternate email"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Access Role Level</label>
                    <Select
                      aria-label="Access role level"
                      value={inviteRole}
                      onChange={(v) => setInviteRole(v as 'super_admin' | 'admin')}
                      className="h-9 text-[13px]"
                      options={[
                        { value: 'admin', label: 'Admin (Standard)' },
                        { value: 'super_admin', label: 'Super Admin (All Privileges)' },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false)
                      setInviteName('')
                      setInviteEmail('')
                      setInviteAltEmail('')
                      setInviteRole('admin')
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInviting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Inviting...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5 text-black" />
                        <span>Send Invitation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- RESET PASSWORD GLASS MODAL --- */}
      {isResetModalOpen && resetTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Reset Password</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Directly override the password for <strong>{resetTargetAdmin.name}</strong> (@{resetTargetAdmin.username || resetTargetAdmin.email}).
                </p>
              </div>

              <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">New Password</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      required
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-3 pr-10 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetModalOpen(false)
                      setResetTargetAdmin(null)
                      setResetNewPassword('')
                      setShowResetPassword(false)
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <span>Reset Password</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT ROLE GLASS MODAL --- */}
      {isEditRoleModalOpen && editRoleTargetAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Edit Access Role</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Change the access level for <strong>{editRoleTargetAdmin.name}</strong> (@{editRoleTargetAdmin.username || editRoleTargetAdmin.email}).
                </p>
              </div>

              <form onSubmit={handleUpdateRole} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">Access Role Level</label>
                  <Select
                    aria-label="Access role level"
                    value={editRoleValue}
                    onChange={(v) => setEditRoleValue(v as 'super_admin' | 'admin')}
                    className="h-9 text-[13px]"
                    options={[
                      { value: 'admin', label: 'Admin (Standard)' },
                      { value: 'super_admin', label: 'Super Admin (All Privileges)' },
                    ]}
                  />
                  {editRoleValue === 'super_admin' && editRoleTargetAdmin.role !== 'super_admin' && (
                    <p className="text-[11px] text-orange-400/80 mt-1.5">
                      Super Admins can manage other admins, the database, and SQL — grant carefully.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditRoleModalOpen(false)
                      setEditRoleTargetAdmin(null)
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingRole || editRoleValue === editRoleTargetAdmin.role}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingRole ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Role</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- REUSABLE CONFIRMATION MODAL --- */}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      {/* --- DECLINE OWNER GLASS MODAL --- */}
      {isDeclineModalOpen && declineTargetOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Decline Application</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Reject <strong>{declineTargetOwner.owner.firstName} {declineTargetOwner.owner.lastName}</strong>. The reason below is emailed to them, and their account is removed so they can apply again.
                </p>
              </div>

              <form onSubmit={handleDeclineOwner} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">Reason for declining</label>
                  <textarea
                    required
                    rows={4}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g. We couldn't verify your company details. Please include a valid company website and re-apply."
                    className="w-full bg-white/[0.02] border border-[var(--color-border)] rounded-lg p-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors resize-none"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)]">This message will be sent to the applicant.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeclineModalOpen(false)
                      setDeclineTargetOwner(null)
                      setDeclineReason('')
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeclining || !declineReason.trim()}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeclining ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                        <span>Declining...</span>
                      </>
                    ) : (
                      <span>Decline &amp; Notify</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- WAITLIST BYPASS PASSWORD GLASS MODAL --- */}
      {isWaitlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">
                  {waitlistEnabled ? 'Change Waitlist Bypass Key' : 'Enable Waitlist Gate'}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Set the bypass code that bypasses waitlist page.
                </p>
              </div>

              <form onSubmit={handleSaveWaitlistConfig} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">Bypass Secret Key</label>
                  <input
                    type="text"
                    required
                    value={waitlistModalPassword}
                    onChange={(e) => setWaitlistModalPassword(e.target.value)}
                    placeholder="e.g., beta_secret_key"
                    className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWaitlistModalOpen(false)
                      setWaitlistModalPassword('')
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTogglingWaitlist}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors disabled:opacity-50"
                  >
                    {isTogglingWaitlist ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{waitlistEnabled ? 'Save Key' : 'Enable Gate'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT PROFILE GLASS MODAL --- */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Edit Profile</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Update your admin account profile parameters.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Alternative Email (Optional)</label>
                    <input
                      type="email"
                      value={profileAltEmail}
                      onChange={(e) => setProfileAltEmail(e.target.value)}
                      placeholder="alternate@email.com"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Primary Email (Read-Only)</label>
                    <input
                      type="text"
                      disabled
                      value={currentAdmin?.email || ''}
                      className="w-full h-9 bg-white/[0.01] border border-[var(--color-border)]/50 rounded-lg px-3 text-xs text-white/40 font-mono select-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Username</label>
                    <input
                      type="text"
                      required
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      placeholder="Your username"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false)
                      if (currentAdmin) {
                        setProfileName(currentAdmin.name || '')
                        setProfileAltEmail(currentAdmin.alternativeEmail || '')
                        setProfileUsername(currentAdmin.username || '')
                      }
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors disabled:opacity-50"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- CHANGE PASSWORD GLASS MODAL --- */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="space-y-4 text-left">
              <div className="border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-medium text-white">Change Password</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Securely update your administrative password credentials.
                </p>
              </div>

              <form onSubmit={handleChangePassword} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">Current Password</label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? "text" : "password"}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-3 pr-10 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-3 pr-10 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-muted)]">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-3 pr-10 text-[13px] text-white focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordModalOpen(false)
                      setOldPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setShowOldPassword(false)
                      setShowNewPassword(false)
                      setShowConfirmPassword(false)
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-black transition-colors disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Themed toast notifications */}
      <ToastContainer />

    </div>
  )
}
