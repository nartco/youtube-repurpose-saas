'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Error signing out')
    } else {
      toast.success('Signed out successfully')
      router.push('/')
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen border-r bg-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold">Dashboard</h2>
            {user && (
              <p className="text-sm text-muted-foreground mt-1">
                {user.email}
              </p>
            )}
          </div>
          <nav className="px-6 space-y-2">
            <Link href="/dashboard" className="block py-2 text-sm hover:text-primary">
              Overview
            </Link>
            <Link href="/history" className="block py-2 text-sm hover:text-primary">
              History
            </Link>
            <Link href="/settings" className="block py-2 text-sm hover:text-primary">
              Settings
            </Link>
          </nav>
          <div className="absolute bottom-6 left-6 right-6">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}