'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, FileText, Search, Kanban, Mic, Mail, Users, BarChart3, Settings, Shield, LogOut, Rocket, Menu, Sparkles, Bell, Moon, Sun, Brain, Zap, Code2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/copilot', icon: Brain, label: 'Career Copilot', accent: true },
  { href: '/dashboard/resumes', icon: FileText, label: 'Resumes' },
  { href: '/dashboard/jobs', icon: Search, label: 'Job Search' },
  { href: '/dashboard/tracker', icon: Kanban, label: 'Applications' },
  { href: '/dashboard/cover-letter', icon: Mail, label: 'Cover Letters' },
  { href: '/dashboard/interview', icon: Mic, label: 'Interview Coach' },
  { href: '/dashboard/playground', icon: Code2, label: 'Coding Playground' },
  { href: '/dashboard/whiteboard', icon: Layers, label: 'Whiteboard' },
  { href: '/dashboard/crm', icon: Users, label: 'Recruiter CRM' },
  { href: '/dashboard/integrations', icon: Zap, label: 'Integrations' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

function SidebarInner({ user, onNav }) {
  const path = usePathname()
  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 h-16 flex items-center gap-2 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center shadow-lg">
          <Rocket className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-bold leading-tight">CareerPilot</div>
          <div className="text-[10px] text-sidebar-foreground/60 leading-tight">AI · v1.0</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {nav.map(item => {
          const active = path === item.href || (item.href !== '/dashboard' && path?.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-indigo-500/20' : item.accent ? 'text-indigo-300 hover:bg-sidebar-accent' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
              <item.icon className="h-4 w-4" />{item.label}
              {item.accent && !active && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">AI</span>}
            </Link>
          )
        })}
        {user?.role === 'admin' && (
          <Link href="/dashboard/admin" onClick={onNav}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${path === '/dashboard/admin' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
            <Shield className="h-4 w-4" />Admin
          </Link>
        )}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 p-4">
          <Sparkles className="h-5 w-5 text-indigo-300 mb-2" />
          <div className="text-sm font-semibold text-sidebar-foreground">AI Provider</div>
          <div className="text-xs text-sidebar-foreground/70 mt-1">{user?.settings?.aiProvider === 'anthropic' ? 'Claude Sonnet 4.5' : user?.settings?.aiProvider === 'google' ? 'Gemini 2.5 Pro' : 'OpenAI GPT-5'}</div>
          <Link href="/dashboard/settings" className="text-xs text-indigo-300 hover:text-indigo-200 mt-2 inline-block">Change →</Link>
        </div>
      </div>
    </div>
  )
}

export default function DashboardShell({ children }) {
  const router = useRouter()
  const path = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.replace('/login'); return }
      setUser(d.user); setLoading(false)
    }).catch(() => { router.replace('/login') })
  }, [router])

  useEffect(() => {
    if (!user) return
    const load = () => fetch('/api/notifications').then(r => r.json()).then(d => setUnread((d.notifications || []).filter(n => !n.read).length))
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [user])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    router.replace('/')
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-muted/30 gradient-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 border-r border-sidebar-border z-30">
        <SidebarInner user={user} />
      </aside>
      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <SidebarInner user={user} onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 border-b border-border/50 backdrop-blur-xl bg-background/70 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet><SheetTrigger asChild><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button></SheetTrigger></Sheet>
          </div>
          <div className="flex items-center gap-2">
            {mounted && (
              <Button size="icon" variant="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Link href="/dashboard/notifications"><Button size="icon" variant="ghost" className="relative"><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">{unread}</span>}</Button></Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-muted p-1 pr-3 transition-colors">
                  <Avatar className="h-8 w-8"><AvatarImage src={user?.picture} /><AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm">{(user?.name || 'U').slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel><div className="font-medium">{user?.name}</div><div className="text-xs text-muted-foreground font-normal">{user?.email}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings className="h-4 w-4 mr-2" />Settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  )
}
