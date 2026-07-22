'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, Target, Award, Globe } from 'lucide-react'

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e']

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('/api/analytics').then(r => r.json()).then(setData) }, [])
  if (!data) return <div className="text-muted-foreground">Loading…</div>

  const statusData = Object.entries(data.statusCount || {}).map(([name, value]) => ({ name, value }))
  const countryData = Object.entries(data.byCountry || {}).map(([name, value]) => ({ name, value })).slice(0, 8)
  const companyData = Object.entries(data.byCompany || {}).map(([name, value]) => ({ name, value })).slice(0, 8)

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Analytics</h1><p className="text-muted-foreground">Your job search performance at a glance.</p></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Applications', value: data.totals.applications, hint: `${data.statusCount?.applied || 0} pending`, icon: Target, color: 'text-blue-500' },
          { label: 'Interview rate', value: `${data.interviewRate}%`, hint: 'of applied', icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Response rate', value: `${data.responseRate}%`, hint: 'incl. rejections', icon: Award, color: 'text-purple-500' },
          { label: 'Best ATS', value: data.bestAts || '—', hint: `avg ${data.avgAts || 0}`, icon: Globe, color: 'text-orange-500' },
        ].map((s, i) => (
          <Card key={i} className="glass border-0"><CardContent className="p-5"><div className="flex items-center justify-between mb-2"><s.icon className={`h-5 w-5 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.hint}</span></div><div className="text-3xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0"><CardHeader><CardTitle>Applications over time</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><LineChart data={data.timeline}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="date" hide /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card className="glass border-0"><CardHeader><CardTitle>Pipeline status</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" outerRadius={80} label>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0"><CardHeader><CardTitle>Top countries</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><BarChart data={countryData}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#a855f7" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card className="glass border-0"><CardHeader><CardTitle>Top companies</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer><BarChart data={companyData} layout="vertical"><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} /><Tooltip /><Bar dataKey="value" fill="#6366f1" radius={[0,8,8,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      <Card className="glass border-0"><CardHeader><CardTitle>Interview performance</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><div className="text-3xl font-bold">{data.totals.interviews}</div><div className="text-xs text-muted-foreground">Practice answers</div></div><div><div className="text-3xl font-bold gradient-text">{data.avgInterviewScore || 0}</div><div className="text-xs text-muted-foreground">Avg. score</div></div><div><div className="text-3xl font-bold">{data.totals.coverLetters}</div><div className="text-xs text-muted-foreground">Cover letters</div></div><div><div className="text-3xl font-bold">{data.totals.contacts}</div><div className="text-xs text-muted-foreground">Contacts</div></div></div></CardContent></Card>
    </div>
  )
}
