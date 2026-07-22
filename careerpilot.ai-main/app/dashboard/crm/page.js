'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Mail, Trash2, Sparkles, Loader2, Copy, MessageCircle, User } from 'lucide-react'

export default function CRMPage() {
  const [contacts, setContacts] = useState([])
  const [resumes, setResumes] = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', company: '', email: '', linkedin: '', phone: '', notes: '' })
  const [outreachOpen, setOutreachOpen] = useState(false)
  const [outreach, setOutreach] = useState({ purpose: 'introduction', jobTitle: '', company: '', resumeId: '', tone: 'professional' })
  const [outputMsg, setOutputMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() { const d = await fetch('/api/crm/contacts').then(r => r.json()); setContacts(d.contacts || []) }
  useEffect(() => { load(); fetch('/api/resumes').then(r => r.json()).then(d => setResumes(d.resumes || [])) }, [])

  async function save() {
    if (!form.name) return toast.error('Name required')
    if (selected) {
      await fetch(`/api/crm/contacts/${selected.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
    } else {
      await fetch('/api/crm/contacts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
    }
    setOpen(false); setSelected(null); setForm({ name: '', title: '', company: '', email: '', linkedin: '', phone: '', notes: '' })
    load(); toast.success('Saved')
  }
  async function del(id) { if (!confirm('Delete?')) return; await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' }); load() }
  function openEdit(c) { setSelected(c); setForm({ name: c.name, title: c.title, company: c.company, email: c.email, linkedin: c.linkedin, phone: c.phone, notes: c.notes }); setOpen(true) }

  async function genOutreach() {
    setBusy(true); setOutputMsg(null)
    try {
      const res = await fetch('/api/crm/outreach', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contactId: selected?.id, ...outreach }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOutputMsg(data.message)
      toast.success('Message generated')
      load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Recruiter CRM</h1><p className="text-muted-foreground">Manage recruiter relationships & personalized outreach.</p></div>
        <Button onClick={() => { setSelected(null); setForm({ name: '', title: '', company: '', email: '', linkedin: '', phone: '', notes: '' }); setOpen(true) }} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"><Plus className="h-4 w-4 mr-2" />Add contact</Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {contacts.map(c => (
          <Card key={c.id} className="glass border-0 hover-lift">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white font-bold">{c.name?.slice(0,1).toUpperCase()}</div>
                  <div><div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.title} · {c.company}</div></div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="text-xs text-muted-foreground mt-3 space-y-1">
                {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                {c.linkedin && <div className="flex items-center gap-1"><User className="h-3 w-3" />{c.linkedin}</div>}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setSelected(c); setOutreach({ ...outreach, company: c.company || outreach.company }); setOutreachOpen(true); setOutputMsg(null) }}><Sparkles className="h-3 w-3 mr-1" />AI outreach</Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                {c.messages?.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px]"><MessageCircle className="h-3 w-3 mr-1" />{c.messages.length}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected ? 'Edit contact' : 'Add contact'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>LinkedIn</Label><Input value={form.linkedin} onChange={e => setForm({...form, linkedin: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outreachOpen} onOpenChange={setOutreachOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalized outreach for {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Purpose</Label>
                <Select value={outreach.purpose} onValueChange={v => setOutreach({...outreach, purpose: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="introduction">Cold intro</SelectItem><SelectItem value="referral">Referral request</SelectItem><SelectItem value="followup">Follow-up</SelectItem><SelectItem value="thank">Thank-you</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Tone</Label>
                <Select value={outreach.tone} onValueChange={v => setOutreach({...outreach, tone: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="professional">Professional</SelectItem><SelectItem value="warm">Warm</SelectItem><SelectItem value="casual">Casual</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Job title (optional)</Label><Input value={outreach.jobTitle} onChange={e => setOutreach({...outreach, jobTitle: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Company (optional)</Label><Input value={outreach.company} onChange={e => setOutreach({...outreach, company: e.target.value})} /></div>
            </div>
            <div className="space-y-1.5"><Label>Resume for facts</Label>
              <Select value={outreach.resumeId} onValueChange={v => setOutreach({...outreach, resumeId: v})}><SelectTrigger><SelectValue placeholder="Choose resume" /></SelectTrigger><SelectContent>{resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={genOutreach} disabled={busy} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Writing…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate outreach</>}</Button>
            {outputMsg && (
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between"><div className="font-semibold">{outputMsg.subject}</div><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(outputMsg.body); toast.success('Copied') }}><Copy className="h-3 w-3 mr-1" />Copy</Button></div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{outputMsg.body}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
