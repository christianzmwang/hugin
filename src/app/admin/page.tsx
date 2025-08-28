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
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Redirect non-admin users
  useEffect(() => {
    if (status === 'loading') return // Still loading
    
    if (!session) {
      router.push('/auth/signin')
      return
    }
    
    // Only christian@allvitr.com can access this admin page
    if (session.user?.email !== 'christian@allvitr.com') {
      router.push('/')
      return
    }
  }, [session, status, router])

  // Load users
  useEffect(() => {
    if (session?.user?.email === 'christian@allvitr.com') {
      loadUsers()
    }
  }, [session])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
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
    const deletableSelected = selectedUsersList.filter(userId => {
      const user = users.find(u => u.id === userId)
      return user && user.email !== 'christian@allvitr.com' // Can't delete admin
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
  if (!session || session.user?.email !== 'christian@allvitr.com') {
    return null
  }

  const verifiedUsers = users.filter(user => user.emailVerified)
  const unverifiedUsers = users.filter(user => !user.emailVerified)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
            >
              Back to App
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <button
                onClick={handleVerifyAllUsers}
                disabled={loading || unverifiedUsers.length === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
              >
                {loading ? 'Processing...' : `Verify All Users (${unverifiedUsers.length})`}
              </button>

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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
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
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              disabled={actionLoading[user.id] || user.email === 'christian@allvitr.com'}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                            >
                              {actionLoading[user.id] ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {users.length === 0 && (
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
  )
}
