'use client'

import { useUser } from '@/lib/hooks/useUser'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Home,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  User
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erreur lors de la déconnexion')
    } else {
      toast.success('Déconnecté avec succès')
      router.push('/')
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-zinc-400 animate-pulse">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, current: pathname === '/dashboard' },
    { name: 'Historique', href: '/history', icon: History, current: pathname === '/history' },
    { name: 'Paramètres', href: '/settings', icon: Settings, current: pathname === '/settings' },
  ]

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 z-50">
            <SidebarContent
              navigation={navigation}
              user={user}
              onLogout={handleLogout}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-zinc-800 lg:bg-zinc-900/50">
        <SidebarContent
          navigation={navigation}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-zinc-900 border-b border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">ContentForge</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-black">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  navigation,
  user,
  onLogout,
  onClose
}: {
  navigation: any[],
  user: any,
  onLogout: () => void,
  onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ContentForge
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* User info */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Credits indicator */}
        <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Crédits ce mois</span>
            <span className="text-xs font-medium">5/10</span>
          </div>
          <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300
                ${item.current
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800 hover:scale-105'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-zinc-800 space-y-2">
        <Link href="/pricing">
          <Button
            variant="outline"
            className="w-full justify-start border-zinc-700 hover:border-purple-500 hover:bg-purple-950/50 transition-all duration-300"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </Link>

        <Button
          onClick={onLogout}
          variant="ghost"
          className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-all duration-300"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}