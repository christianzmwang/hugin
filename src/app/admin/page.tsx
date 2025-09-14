'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  created_at: Date
  updated_at: Date
  main_access?: boolean | null
  role?: 'admin' | 'manager' | 'user'
  lastSession?: string | Date | null
  creditsUsedMonth?: number
  creditsRemaining?: number
  creditsMonthlyLimit?: number
  creditsUsedChatMonth?: number
  creditsUsedResearchMonth?: number
}

interface ApiResponse {
  success: boolean
  message: string
  error?: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  interface EmailCampaign {
    id: number
    user_id?: string
    user_email: string
    subject: string
    body: string
    list_id?: number | null
    company_count: number
    org_numbers?: string[]
    created_at: string
  }
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null)
  const [showCampaignModal, setShowCampaignModal] = useState(false)

  // Redirect non-admin/manager users
  useEffect(() => {
    if (status === 'loading') return // Still loading
    
    if (!session) {
      router.push('/auth/signin')
      return
    }
    
    // Allow admin or manager
    const role = (session.user as any)?.role
    if (role !== 'admin' && role !== 'manager') {
      router.push('/')
      return
    }
  }, [session, status, router])

  // Load users
  useEffect(() => {
    const role = (session?.user as any)?.role
    if (role === 'admin' || role === 'manager') {
      loadUsers()
  loadCampaigns()
    }
  }, [session])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/users')
      const data = await response.json()
  if (data.success) {
        setUsers(data.users)
      } else {
        setUsers([])
        setError(data.message || data.error || 'Failed to load users')
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      setError('DB connection unsuccessful')
    } finally {
      setLoading(false)
    }
  }

  const loadCampaigns = async () => {
    try {
      setCampaignsLoading(true)
      const r = await fetch('/api/email-campaigns')
      const j = await r.json()
      if (Array.isArray(j.items)) setCampaigns(j.items)
    } catch {
      setCampaigns([])
    } finally { setCampaignsLoading(false) }
  }

  // Close modal with escape
  useEffect(() => {
    if (!showCampaignModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowCampaignModal(false); setSelectedCampaign(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCampaignModal])

  const openCampaign = (c: EmailCampaign) => {
    setSelectedCampaign(c)
    setShowCampaignModal(true)
  }

  const setUserActionLoading = (userId: string, loading: boolean) => {
    setActionLoading(prev => ({ ...prev, [userId]: loading }))
  }

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(userId)
      } else {
        newSet.delete(userId)
      }
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(user => user.id)))
    } else {
      setSelectedUsers(new Set())
    }
  }

  const handleBulkVerify = async () => {
    const selectedUsersList = Array.from(selectedUsers)
    const unverifiedSelected = selectedUsersList.filter(userId => {
      const user = users.find(u => u.id === userId)
      return user && !user.emailVerified
    })

    if (unverifiedSelected.length === 0) {
      alert('No unverified users selected.')
      return
    }

    if (!confirm(`Are you sure you want to verify ${unverifiedSelected.length} selected users?`)) {
      return
    }

    setBulkActionLoading(true)
    let successCount = 0
    let failCount = 0

    for (const userId of unverifiedSelected) {
      try {
        const response = await fetch('/api/admin/verify-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        const data = await response.json()
        if (data.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setBulkActionLoading(false)
    await loadUsers() // Refresh the list
    setSelectedUsers(new Set()) // Clear selection
    alert(`Bulk verification completed: ${successCount} successful, ${failCount} failed`)
  }

  const handleBulkResendVerification = async () => {
    const selectedUsersList = Array.from(selectedUsers)
    const unverifiedSelected = selectedUsersList.filter(userId => {
      const user = users.find(u => u.id === userId)
      return user && !user.emailVerified
    })

    if (unverifiedSelected.length === 0) {
      alert('No unverified users selected.')
      return
    }

    if (!confirm(`Are you sure you want to resend verification emails to ${unverifiedSelected.length} selected users?`)) {
      return
    }

    setBulkActionLoading(true)
    let successCount = 0
    let failCount = 0

    for (const userId of unverifiedSelected) {
      try {
        const response = await fetch('/api/admin/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        const data = await response.json()
        if (data.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setBulkActionLoading(false)
    setSelectedUsers(new Set()) // Clear selection
    alert(`Bulk email sending completed: ${successCount} successful, ${failCount} failed`)
  }

  const handleBulkDelete = async () => {
    const selectedUsersList = Array.from(selectedUsers)
  const actorRole = (session!.user as any)?.role
    const deletableSelected = selectedUsersList.filter(userId => {
      const user = users.find(u => u.id === userId)
      if (!user) return false
      if (user.email === 'christian@allvitr.com') return false // Can't delete admin
      if (actorRole === 'manager' && (user.role === 'admin' || user.role === 'manager')) return false
      return true
    })

    if (deletableSelected.length === 0) {
      alert('No deletable users selected (admin user cannot be deleted).')
      return
    }

    if (!confirm(`⚠️ WARNING: Are you sure you want to DELETE ${deletableSelected.length} selected users? This action CANNOT be undone!`)) {
      return
    }

    setBulkActionLoading(true)
    let successCount = 0
    let failCount = 0

    for (const userId of deletableSelected) {
      try {
        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        const data = await response.json()
        if (data.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setBulkActionLoading(false)
    await loadUsers() // Refresh the list
    setSelectedUsers(new Set()) // Clear selection
    alert(`Bulk deletion completed: ${successCount} successful, ${failCount} failed`)
  }

  const handleVerifyUser = async (userId: string) => {
    setUserActionLoading(userId, true)
    try {
      const response = await fetch('/api/admin/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data: ApiResponse = await response.json()
      
      if (data.success) {
        await loadUsers() // Refresh the list
        alert('User verified successfully!')
      } else {
        alert(`Failed to verify user: ${data.message}`)
      }
    } catch {
      alert('Failed to verify user')
    } finally {
      setUserActionLoading(userId, false)
    }
  }

  const handleResendVerification = async (userId: string) => {
    setUserActionLoading(userId, true)
    try {
      const response = await fetch('/api/admin/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data: ApiResponse = await response.json()
      
      if (data.success) {
        alert('Verification email sent successfully!')
      } else {
        alert(`Failed to send verification email: ${data.message}`)
      }
    } catch {
      alert('Failed to send verification email')
    } finally {
      setUserActionLoading(userId, false)
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return
    }

    setUserActionLoading(userId, true)
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data: ApiResponse = await response.json()
      
      if (data.success) {
        await loadUsers() // Refresh the list
        alert('User deleted successfully!')
      } else {
        alert(`Failed to delete user: ${data.message}`)
      }
    } catch {
      alert('Failed to delete user')
    } finally {
      setUserActionLoading(userId, false)
    }
  }

  const handlePromoteToManager = async (userId: string) => {
    setUserActionLoading(userId, true)
    try {
      const response = await fetch('/api/admin/promote-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data: ApiResponse = await response.json()
      if (response.ok && data.success) {
        await loadUsers()
        alert('User promoted to manager')
      } else {
        alert(data.message || 'Failed to promote user')
      }
    } catch (e) {
      alert('Failed to promote user')
    } finally {
      setUserActionLoading(userId, false)
    }
  }

  const handleToggleMainAccess = async (userId: string, allow: boolean) => {
    setUserActionLoading(userId, true)
    try {
      const response = await fetch('/api/admin/toggle-main-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, allow })
      })
      const data: ApiResponse & { user?: { id: string; main_access: boolean } } = await response.json()
      if (data.success) {
        await loadUsers()
      } else {
        alert(data.message || 'Failed to update access')
      }
  } catch {
      alert('Failed to update access')
    } finally {
      setUserActionLoading(userId, false)
    }
  }

  const handleVerifyAllUsers = async () => {
    if (!confirm('Are you sure you want to verify all unverified users?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/verify-all-users', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        await loadUsers() // Refresh the list
        alert(`Successfully verified ${data.verifiedCount} users!`)
      } else {
        alert(`Failed to verify users: ${data.message}`)
      }
    } catch {
      alert('Failed to verify users')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated or not authorized
  if (!session || !(['admin','manager'].includes((session.user as any)?.role))) {
    return null
  }

  const verifiedUsers = users.filter(user => user.emailVerified)
  const unverifiedUsers = users.filter(user => !user.emailVerified)

  return (
    <>
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-6 py-8 mx-auto max-w-full">
        <div className="w-full">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Manage</h1>
            <div className="text-xs text-gray-400">Role: {(session.user as any)?.role}</div>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
            >
              Back to App
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Users</h3>
              <p className="text-3xl font-bold text-blue-400">{users.length}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Verified Users</h3>
              <p className="text-3xl font-bold text-green-400">{verifiedUsers.length}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Unverified Users</h3>
              <p className="text-3xl font-bold text-red-400">{unverifiedUsers.length}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Monthly Credits Used</h3>
              <p className="text-3xl font-bold text-purple-400">{users.reduce((acc,u)=>acc + (u.creditsUsedMonth||0),0)}</p>
            </div>
          </div>

          {/* Email Campaigns */}
          <div className="bg-gray-900 p-6 rounded-lg mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Email Campaigns</h2>
              <button onClick={loadCampaigns} className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">Refresh</button>
            </div>
            {campaignsLoading ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : campaigns.length === 0 ? (
              <div className="text-sm text-gray-500">No campaigns yet.</div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Created</th>
                      <th className="text-left px-3 py-2">Subject</th>
                      <th className="text-left px-3 py-2">User</th>
                      <th className="text-left px-3 py-2">Companies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {campaigns.map(c => (
                      <tr key={c.id} className="hover:bg-gray-800/60 cursor-pointer" onClick={() => openCampaign(c)}>
                        <td className="px-3 py-2 text-xs text-gray-400">{c.id}</td>
                        <td className="px-3 py-2 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={c.subject}>{c.subject}</td>
                        <td className="px-3 py-2 text-xs text-gray-300">{c.user_email}</td>
                        <td className="px-3 py-2 text-xs">{c.company_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="bg-gray-900 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Bulk Actions</h2>
            
            {/* Selected users info */}
            {selectedUsers.size > 0 && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50">
                <p className="text-sm text-blue-300">
                  {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              {/* Verify All (existing) */}
              {(['admin','manager'].includes((session.user as any)?.role)) && (
                <button
                  onClick={handleVerifyAllUsers}
                  disabled={loading || unverifiedUsers.length === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
                >
                  {loading ? 'Processing...' : `Verify All Users (${unverifiedUsers.length})`}
                </button>
              )}

              {/* Multi-select actions */}
              <button
                onClick={handleBulkVerify}
                disabled={bulkActionLoading || selectedUsers.size === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
              >
                {bulkActionLoading ? 'Processing...' : `Verify Selected (${selectedUsers.size})`}
              </button>

              <button
                onClick={handleBulkResendVerification}
                disabled={bulkActionLoading || selectedUsers.size === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
              >
                {bulkActionLoading ? 'Processing...' : `Resend Selected (${selectedUsers.size})`}
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading || selectedUsers.size === 0}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
              >
                {bulkActionLoading ? 'Processing...' : `Delete Selected (${selectedUsers.size})`}
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold">All Users ({users.length})</h2>
            </div>
            {error && (
              <div className="px-6 py-4 bg-red-900/30 border-b border-red-700 text-red-300">
                {error}
              </div>
            )}
            
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading users...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === users.length && users.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Main Access</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Last Login</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Credits (Used / Limit)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {user.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400">ID: {user.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.emailVerified 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.emailVerified ? 'Verified' : 'Unverified'}
                          </span>
                          {user.emailVerified && (
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(user.emailVerified).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.main_access ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.main_access ? 'Allowed' : 'No Access'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{user.role || 'user'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {user.lastSession ? new Date(user.lastSession).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {typeof user.creditsUsedMonth === 'number' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-gray-200 font-medium">
                                {user.creditsUsedMonth} / {user.creditsMonthlyLimit}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide text-gray-400">Chat {user.creditsUsedChatMonth||0} • Research {user.creditsUsedResearchMonth||0}</span>
                              <span className="text-xs text-gray-500">Rem: {user.creditsRemaining}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">n/a</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleToggleMainAccess(user.id, !Boolean(user.main_access))}
                              disabled={actionLoading[user.id]}
                              className={`${user.main_access ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs`}
                            >
                              {actionLoading[user.id] ? '...' : (user.main_access ? 'Revoke Access' : 'Grant Access')}
                            </button>
                            {(() => {
                              const actorRole = (session.user as any)?.role
                              const canPromote = actorRole === 'admin' && user.role !== 'manager' && user.role !== 'admin'
                              return (
                                <button
                                  onClick={() => handlePromoteToManager(user.id)}
                                  disabled={actionLoading[user.id] || !canPromote}
                                  title={!canPromote ? 'Only admins can promote, and not admins/managers' : undefined}
                                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                                >
                                  {actionLoading[user.id] ? '...' : 'Promote to Manager'}
                                </button>
                              )
                            })()}
                            {!user.emailVerified && (
                              <>
                                <button
                                  onClick={() => handleVerifyUser(user.id)}
                                  disabled={actionLoading[user.id]}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                                >
                                  {actionLoading[user.id] ? '...' : 'Verify'}
                                </button>
                                <button
                                  onClick={() => handleResendVerification(user.id)}
                                  disabled={actionLoading[user.id]}
                                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                                >
                                  {actionLoading[user.id] ? '...' : 'Resend'}
                                </button>
                              </>
                            )}
                            {(() => {
                              const actorRole = (session.user as any)?.role
                              const cannotDelete = actionLoading[user.id] || user.email === 'christian@allvitr.com' || (actorRole === 'manager' && (user.role === 'manager' || user.role === 'admin'))
                              return (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  disabled={cannotDelete}
                                  title={cannotDelete && actorRole === 'manager' && (user.role === 'manager' || user.role === 'admin') ? 'Managers cannot delete admins or other managers' : undefined}
                                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                                >
                                  {actionLoading[user.id] ? '...' : 'Delete'}
                                </button>
                              )
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {users.length === 0 && !error && (
                  <div className="p-8 text-center text-gray-400">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  </div>
  {showCampaignModal && selectedCampaign && (
      <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/80">
        <div className="w-full max-w-4xl bg-gray-950 border border-gray-700 rounded-lg shadow-xl flex flex-col max-h-full">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div>
              <h3 className="text-lg font-semibold">Campaign #{selectedCampaign.id}</h3>
              <div className="text-xs text-gray-400 mt-0.5">{new Date(selectedCampaign.created_at).toLocaleString()} • {selectedCampaign.user_email}</div>
            </div>
            <button onClick={() => { setShowCampaignModal(false); setSelectedCampaign(null) }} className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">Close</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-1 overflow-hidden">
            <div className="border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col">
              <div className="p-4 overflow-y-auto">
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Subject</div>
                  <div className="text-sm bg-gray-800/60 px-3 py-2 rounded border border-gray-700 break-words">{selectedCampaign.subject}</div>
                </div>
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Body</div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed bg-gray-800/40 px-3 py-3 rounded border border-gray-700 max-h-[360px] overflow-auto">
                    {selectedCampaign.body}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="p-4 flex items-center justify-between border-b border-gray-800">
                <div className="text-sm font-medium">Companies ({selectedCampaign.company_count})</div>
                <button
                  onClick={() => {
                    if (!selectedCampaign.org_numbers || !selectedCampaign.org_numbers.length) return
                    const header = 'orgNumber\n'
                    const csv = header + selectedCampaign.org_numbers.join('\n')
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `campaign-${selectedCampaign.id}-org-numbers.csv`
                    document.body.appendChild(a)
                    a.click()
                    setTimeout(() => {
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }, 200)
                  }}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                >Export CSV</button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {selectedCampaign.org_numbers && selectedCampaign.org_numbers.length > 0 ? (
                  <ul className="text-xs grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-1">
                    {selectedCampaign.org_numbers.map((o: string) => (
                      <li key={o} className="px-2 py-1 bg-gray-800/40 rounded border border-gray-800 truncate" title={o}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-gray-500">No org numbers stored.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
