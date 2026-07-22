'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, Kanban, Calendar as CalendarIcon, Building2, MapPin } from 'lucide-react'

const STATUSES = [
  { key: 'saved', label: 'Saved', color: 'bg-slate-500/20 text-slate-600 border-slate-500/30' },
  { key: 'applied', label: 'Applied', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  { key: 'assessment', label: 'Assessment', color: 'bg-purple-500/20 text-purple-600 border-purple-500/30' },
  { key: 'interview', label: 'Interview', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' },
  { key: 'accepted', label: 'Accepted', color: 'bg-emerald-600/20 text-emerald-700 border-emerald-600/30' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
]

export default function TrackerPage() {
  const [apps, setApps] = useState([])
  const [view, setView] = useState('kanban')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ jobTitle: '', company: '', location: '', salary: '', link: '', notes: '', status: 'applied' })
  const [editing, setEditing] = useState(null)

  async function load() { const d = await fetch('/api/applications').then(r => r.json()); setApps(d.applications || []) }
  useEffect(() => { load() }, [])

  async function save() {
    if (editing) {
      const res = await fetch(`/api/applications/${editing.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
      if (!res.ok) return toast.error('Update failed')
      toast.success('Updated')
    } else {
      const res = await fetch('/api/applications', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
      if (!res.ok) return toast.error('Create failed')
      toast.success('Added')
    }
    setOpen(false); setEditing(null); setForm({ jobTitle: '', company: '', location: '', salary: '', link: '', notes: '', status: 'applied' })
    load()
  }

  async function updateStatus(id, status) {
    await fetch(`/api/applications/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status }) })
    load()
  }

  async function del(id) {
    if (!confirm('Delete this application?')) return
    await fetch(`/api/applications/${id}`, { method: 'DELETE' }); load(); toast.success('Deleted')
  }

  function openEdit(app) { setEditing(app); setForm({ jobTitle: app.jobTitle, company: app.company, location: app.location, salary: app.salary, link: app.link, notes: app.notes, status: app.status }); setOpen(true) }

  const grouped = STATUSES.reduce((a, s) => { a[s.key] = apps.filter(x => x.status === s.key); return a }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Application Tracker</h1><p className="text-muted-foreground">Kanban, timeline & calendar views of your pipeline.</p></div>
        <div className="flex gap-2">
          <Select value={view} onValueChange={setView}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kanban">Kanban</SelectItem><SelectItem value="timeline">Timeline</SelectItem><SelectItem value="calendar">Calendar</SelectItem></SelectContent></Select>
          <Button onClick={() => { setEditing(null); setForm({ jobTitle: '', company: '', location: '', salary: '', link: '', notes: '', status: 'applied' }); setOpen(true) }} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"><Plus className="h-4 w-4 mr-2" />Add application</Button>
        </div>
      </div>

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
          {STATUSES.map(s => (
            <div key={s.key} className="glass rounded-xl p-3 min-h-[300px]">
              <div className={`flex items-center justify-between px-2 py-1 rounded-md text-xs font-semibold ${s.color} border mb-3`}><span>{s.label}</span><span>{grouped[s.key]?.length || 0}</span></div>
              <div className="space-y-2">
                {grouped[s.key]?.map(app => (
                  <div key={app.id} onClick={() => openEdit(app)} className="bg-card rounded-lg border p-3 cursor-pointer hover-lift">
                    <div className="font-medium text-sm truncate">{app.jobTitle}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Building2 className="h-3 w-3" />{app.company}</div>
                    {app.location && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{app.location}</div>}
                    <div className="flex items-center gap-1 mt-2">
                      <Select value={app.status} onValueChange={v => updateStatus(app.id, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(x => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'timeline' && (
        <div className="space-y-3">
          {apps.map(app => (
            <Card key={app.id} className="glass border-0">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white text-sm font-bold">{app.company?.slice(0,2).toUpperCase()}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="font-medium">{app.jobTitle} — {app.company}</div><div className="text-xs text-muted-foreground">{app.location}</div></div>
                      <div className="flex items-center gap-2"><Badge className={STATUSES.find(s => s.key === app.status)?.color + ' border'}>{app.status}</Badge><Button size="icon" variant="ghost" onClick={() => openEdit(app)}><ExternalLink className="h-3 w-3" /></Button><Button size="icon" variant="ghost" onClick={() => del(app.id)}><Trash2 className="h-3 w-3" /></Button></div>
                    </div>
                    <div className="mt-3 space-y-1">{(app.events || []).slice(-5).map((e, i) => (<div key={i} className="text-xs text-muted-foreground flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" />{new Date(e.at).toLocaleString()} — {e.note}</div>))}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === 'calendar' && (
        <CalendarView apps={apps} onOpen={openEdit} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit application' : 'Add application'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Job title</Label><Input value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Salary</Label><Input value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} /></div>
            </div>
            <div className="space-y-1.5"><Label>Link</Label><Input value={form.link} onChange={e => setForm({...form, link: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(x => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CalendarView({ apps, onOpen }) {
  const now = new Date()
  const y = now.getFullYear(); const m = now.getMonth()
  const first = new Date(y, m, 1); const daysInMonth = new Date(y, m + 1, 0).getDate()
  const startDay = first.getDay()
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return (
    <Card className="glass border-0">
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const dayApps = d ? apps.filter(a => { const dt = new Date(a.appliedDate || a.createdAt); return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d }) : []
            return (
              <div key={i} className={`min-h-[80px] rounded-lg border p-1.5 ${d ? 'bg-card' : ''}`}>
                {d && <div className="text-xs font-medium">{d}</div>}
                {dayApps.slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => onOpen(a)} className="mt-1 text-[10px] p-1 rounded bg-primary/10 text-primary truncate cursor-pointer">{a.company}</div>
                ))}
                {dayApps.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayApps.length - 3}</div>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
