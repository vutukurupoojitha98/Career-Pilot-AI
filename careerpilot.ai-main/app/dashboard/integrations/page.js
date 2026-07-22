'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Mail, CheckCircle2, XCircle, Send, ExternalLink, Loader2, Sparkles } from 'lucide-react'

function IntegrationsInner() {
  const params = useSearchParams()
  const [gmail, setGmail] = useState(null)
  const [ms, setMs] = useState(null)
  const [log, setLog] = useState([])
  const [composeOpen, setComposeOpen] = useState(null) // 'gmail' | 'microsoft'
  const [form, setForm] = useState({ to: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const g = await fetch('/api/integrations/gmail/status').then(r => r.json()); setGmail(g)
    const m = await fetch('/api/integrations/microsoft/status').then(r => r.json()); setMs(m)
    const l = await fetch('/api/integrations/email-log').then(r => r.json()); setLog(l.emails || [])
  }
  useEffect(() => {
    load()
    if (params.get('connected') === 'gmail') toast.success('Gmail connected!')
    if (params.get('connected') === 'microsoft') toast.success('Microsoft 365 connected!')
    if (params.get('error')) toast.error('OAuth error: ' + params.get('error'))
  }, [])

  async function connect(provider) {
    const r = await fetch(`/api/integrations/${provider}/connect`).then(r => r.json())
    if (r.url) window.location.href = r.url
    else toast.error(r.error || 'Could not start OAuth')
  }
  async function disconnect(provider) {
    await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' }); load(); toast.success('Disconnected')
  }
  async function send(provider) {
    if (!form.to || !form.subject || !form.body) return toast.error('All fields required')
    setBusy(true)
    try {
      const r = await fetch(`/api/integrations/${provider}/send`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      toast.success('Email sent!'); setComposeOpen(null); setForm({ to: '', subject: '', body: '' }); load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const ProviderCard = ({ name, provider, status, brand }) => (
    <Card className="glass border-0">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />{name}</CardTitle><CardDescription>{brand}</CardDescription></div>
          {status?.connected ? <Badge variant="default" className="bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge> : status?.configured ? <Badge variant="secondary">Not connected</Badge> : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not configured</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.connected && <div className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{status.email}</span></div>}
        {!status?.configured && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-xs space-y-1">
            <div className="font-medium text-orange-600">Missing environment variables:</div>
            <div className="font-mono text-orange-700 dark:text-orange-400">{status?.missingEnv?.join(', ')}</div>
            <div className="text-muted-foreground mt-2">Add to .env and restart the service to enable this integration.</div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {!status?.connected ? (
            <Button size="sm" onClick={() => connect(provider)} disabled={!status?.configured} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"><ExternalLink className="h-3 w-3 mr-1" />Connect {name}</Button>
          ) : (
            <>
              <Button size="sm" onClick={() => { setComposeOpen(provider); setForm({ to: '', subject: '', body: '' }) }} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"><Send className="h-3 w-3 mr-1" />Send email</Button>
              <Button size="sm" variant="outline" onClick={() => disconnect(provider)}>Disconnect</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Email Integrations</h1><p className="text-muted-foreground">Connect Gmail or Microsoft 365 to send recruiter outreach directly from CareerPilot.</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        <ProviderCard name="Gmail" provider="gmail" status={gmail} brand="Google Workspace" />
        <ProviderCard name="Microsoft 365" provider="microsoft" status={ms} brand="Outlook / Exchange" />
      </div>
      <Card className="glass border-0">
        <CardHeader><CardTitle>Recent sent emails</CardTitle></CardHeader>
        <CardContent>
          {log.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6">No emails sent yet.</div> : (
            <div className="space-y-2">
              {log.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div><div className="text-sm font-medium">{e.subject}</div><div className="text-xs text-muted-foreground">to {e.to} · {new Date(e.sentAt).toLocaleString()}</div></div>
                  <Badge variant="outline">{e.provider}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!composeOpen} onOpenChange={o => !o && setComposeOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Send email via {composeOpen === 'gmail' ? 'Gmail' : 'Microsoft 365'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>To</Label><Input value={form.to} onChange={e => setForm({...form, to: e.target.value})} placeholder="recipient@example.com" /></div>
            <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Body</Label><Textarea rows={8} value={form.body} onChange={e => setForm({...form, body: e.target.value})} /></div>
            <Button onClick={() => send(composeOpen)} disabled={busy} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : <><Send className="h-4 w-4 mr-2" />Send email</>}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function IntegrationsPage() {
  return <Suspense fallback={null}><IntegrationsInner /></Suspense>
}
