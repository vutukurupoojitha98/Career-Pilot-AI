'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Users, FileText, Kanban, Mic, Flag, FileSearch, CreditCard, RefreshCw } from 'lucide-react'

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [flags, setFlags] = useState([])
  const [subs, setSubs] = useState(null)
  async function load() {
    const [s, u, l, f, sub] = await Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/audit-logs?limit=200').then(r => r.json()),
      fetch('/api/admin/feature-flags').then(r => r.json()),
      fetch('/api/admin/subscriptions').then(r => r.json()),
    ])
    setStats(s); setUsers(u.users || []); setLogs(l.logs || []); setFlags(f.flags || []); setSubs(sub)
  }
  useEffect(() => { load() }, [])
  async function toggleFlag(key, enabled) {
    await fetch('/api/admin/feature-flags', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ key, enabled }) })
    setFlags(fs => fs.map(f => f.key === key ? { ...f, enabled } : f))
    toast.success(`${key} ${enabled ? 'enabled' : 'disabled'}`)
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1><p className="text-muted-foreground">Users · subscriptions · logs · feature flags.</p></div><Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button></div>
      <div className="grid md:grid-cols-4 gap-4">
        {[['Users', stats?.users || 0, Users, 'text-indigo-500'],['Resumes', stats?.resumes || 0, FileText, 'text-purple-500'],['Applications', stats?.applications || 0, Kanban, 'text-emerald-500'],['Interviews', stats?.interviews || 0, Mic, 'text-amber-500']].map(([l, v, Ic, c]) => (
          <Card key={l} className="glass border-0"><CardContent className="p-5"><Ic className={`h-5 w-5 ${c} mb-2`} /><div className="text-3xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></CardContent></Card>
        ))}
      </div>
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger><TabsTrigger value="subscriptions"><CreditCard className="h-4 w-4 mr-1" />Subscriptions</TabsTrigger><TabsTrigger value="flags"><Flag className="h-4 w-4 mr-1" />Feature Flags</TabsTrigger><TabsTrigger value="logs"><FileSearch className="h-4 w-4 mr-1" />Audit Logs</TabsTrigger></TabsList>
        <TabsContent value="users" className="pt-4">
          <Card className="glass border-0"><CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Provider</TableHead><TableHead>Role</TableHead><TableHead>Plan</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
            <TableBody>{users.map(u => (<TableRow key={u.id}><TableCell className="font-medium">{u.name}</TableCell><TableCell>{u.email}</TableCell><TableCell><Badge variant="outline">{u.provider}</Badge></TableCell><TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></TableCell><TableCell>{u.plan}</TableCell><TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell></TableRow>))}</TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="subscriptions" className="pt-4">
          <div className="grid md:grid-cols-3 gap-4">{subs && Object.entries(subs.byPlan).map(([plan, data]) => (
            <Card key={plan} className="glass border-0"><CardHeader><CardTitle className="capitalize flex items-center justify-between">{plan}<Badge className="text-2xl">{data.count}</Badge></CardTitle></CardHeader><CardContent><div className="text-xs space-y-1 max-h-64 overflow-auto">{data.users.slice(0, 20).map(u => <div key={u.id}>{u.email}</div>)}</div></CardContent></Card>
          ))}</div>
        </TabsContent>
        <TabsContent value="flags" className="pt-4">
          <Card className="glass border-0"><CardContent className="p-4 space-y-2">{flags.map(f => (
            <div key={f.key} className="flex items-center justify-between p-3 rounded-lg border"><div><div className="font-medium">{f.key}</div><div className="text-xs text-muted-foreground">{f.description}</div></div><Switch checked={f.enabled} onCheckedChange={v => toggleFlag(f.key, v)} /></div>
          ))}</CardContent></Card>
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <Card className="glass border-0"><CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Meta</TableHead></TableRow></TableHeader>
            <TableBody>{logs.map(l => (<TableRow key={l.id}><TableCell className="text-xs">{new Date(l.at).toLocaleString()}</TableCell><TableCell><Badge variant="outline">{l.action}</Badge></TableCell><TableCell className="text-xs">{l.user?.email || '—'}</TableCell><TableCell className="text-xs font-mono max-w-md truncate">{JSON.stringify(l.meta || {})}</TableCell></TableRow>))}</TableBody>
          </Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
