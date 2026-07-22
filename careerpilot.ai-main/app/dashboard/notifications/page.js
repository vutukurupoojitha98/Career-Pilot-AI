'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Bell, Check, Sparkles } from 'lucide-react'

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  async function load() { const d = await fetch('/api/notifications').then(r => r.json()); setItems(d.notifications || []) }
  useEffect(() => { load() }, [])
  async function markAll() { await fetch('/api/notifications/read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) }); load(); toast.success('All marked as read') }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Notifications</h1><p className="text-muted-foreground">Job matches, interview reminders, follow-ups.</p></div><Button variant="outline" onClick={markAll}><Check className="h-4 w-4 mr-2" />Mark all read</Button></div>
      {items.length === 0 ? <Card className="glass border-0"><CardContent className="p-12 text-center"><Bell className="h-10 w-10 mx-auto opacity-40 mb-3" /><div className="text-muted-foreground">You're all caught up!</div></CardContent></Card> : (
        <div className="space-y-2">{items.map(n => (
          <Card key={n.id} className={`glass border-0 ${!n.read ? 'ring-1 ring-primary/30' : ''}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center shrink-0"><Sparkles className="h-5 w-5 text-white" /></div>
              <div className="flex-1"><div className="flex items-center gap-2"><div className="font-medium">{n.title}</div>{!n.read && <Badge variant="default" className="text-[10px]">New</Badge>}</div><div className="text-sm text-muted-foreground">{n.body}</div><div className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div></div>
            </CardContent>
          </Card>
        ))}</div>
      )}
    </div>
  )
}
