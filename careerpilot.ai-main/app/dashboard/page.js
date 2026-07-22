'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileText, Search, Kanban, Mic, ArrowRight, Sparkles, TrendingUp, Target, Zap } from 'lucide-react'

export default function DashboardHome() {
  const [me, setMe] = useState(null)
  const [resumes, setResumes] = useState([])
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMe(d.user))
    fetch('/api/resumes').then(r => r.json()).then(d => setResumes(d.resumes || []))
  }, [])

  const topResume = resumes[0]
  const bestScore = resumes.reduce((m, r) => Math.max(m, r.atsScore || 0), 0)

  const quickActions = [
    { href: '/dashboard/resumes', icon: FileText, title: 'Upload Resume', desc: 'Analyze + optimize your CV', color: 'from-indigo-500 to-purple-600' },
    { href: '/dashboard/jobs', icon: Search, title: 'Find Jobs', desc: 'AI-matched roles for you', color: 'from-purple-500 to-pink-600' },
    { href: '/dashboard/interview', icon: Mic, title: 'Practice Interview', desc: 'HR, Tech, Coding, Behavioral', color: 'from-emerald-500 to-teal-600' },
    { href: '/dashboard/tracker', icon: Kanban, title: 'Track Applications', desc: 'Kanban board & pipeline', color: 'from-orange-500 to-red-600' },
  ]

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back, {me?.name?.split(' ')[0] || 'there'} 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your career command center.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Resumes', value: resumes.length, icon: FileText, trend: '+' + resumes.length },
          { label: 'Best ATS Score', value: bestScore || '—', icon: TrendingUp, trend: bestScore ? bestScore + '/100' : 'Analyze one' },
          { label: 'Job Matches', value: 0, icon: Target, trend: 'Coming soon' },
          { label: 'Interviews', value: 0, icon: Mic, trend: 'Practice now' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass border-0 hover-lift">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <s.icon className="h-5 w-5 text-primary" />
                  <Badge variant="secondary" className="text-[10px]">{s.trend}</Badge>
                </div>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a, i) => (
            <Link key={a.href} href={a.href}>
              <Card className="glass border-0 hover-lift cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} grid place-items-center mb-3 shadow-lg`}><a.icon className="h-5 w-5 text-white" /></div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Top resume */}
      {topResume ? (
        <Card className="glass-strong border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Latest resume</CardTitle>
              <CardDescription>{topResume.title}</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline"><Link href={`/dashboard/resumes`}>Open <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {topResume.atsScore ? (
              <div>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">ATS Score</span><span className="text-2xl font-bold gradient-text">{topResume.atsScore}/100</span></div>
                <Progress value={topResume.atsScore} className="h-2" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Not analyzed yet</div>
                <Button asChild size="sm"><Link href="/dashboard/resumes">Analyze now</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-strong border-0 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10" />
          <CardContent className="p-8 relative text-center">
            <Zap className="h-8 w-8 mx-auto text-primary mb-3" />
            <h3 className="text-xl font-bold mb-2">Start with your resume</h3>
            <p className="text-muted-foreground text-sm mb-4">Upload your PDF or DOCX and get an instant ATS score plus AI-powered improvements.</p>
            <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              <Link href="/dashboard/resumes">Upload resume <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
