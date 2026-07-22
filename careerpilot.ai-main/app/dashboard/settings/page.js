'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { Save, Sparkles, User, Palette, Bell, Shield, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({ aiProvider: 'openai', aiModel: 'gpt-5', notifyEmail: true, locationPref: '', theme: 'system' })
  const [name, setName] = useState('')
  const [models, setModels] = useState({})
  const { setTheme } = useTheme()

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setUser(d.user); setSettings(d.user.settings); setName(d.user.name) })
    fetch('/api/models').then(r => r.json()).then(d => setModels(d.models || {}))
  }, [])

  async function save() {
    const res = await fetch('/api/settings', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ settings, name }) })
    if (!res.ok) return toast.error('Save failed')
    setTheme(settings.theme)
    toast.success('Settings saved')
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Settings</h1><p className="text-muted-foreground">Personalize your CareerPilot experience.</p></div>
      <Card className="glass border-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email || ''} disabled /></div>
          </div>
        </CardContent>
      </Card>
      <Card className="glass border-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI Provider</CardTitle><CardDescription>Choose which AI powers your resume analysis, matching, and interview coaching.</CardDescription></CardHeader>
        <CardContent>
          <RadioGroup value={settings.aiProvider} onValueChange={v => setSettings({ ...settings, aiProvider: v, aiModel: models[v]?.model || '' })} className="grid md:grid-cols-3 gap-3">
            {Object.entries(models).map(([key, m]) => (
              <div key={key}>
                <RadioGroupItem value={key} id={key} className="peer sr-only" />
                <Label htmlFor={key} className="flex flex-col cursor-pointer glass rounded-xl p-4 border-2 border-transparent peer-data-[state=checked]:border-primary transition">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{m.model}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      <Card className="glass border-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Appearance</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-sm"><Label>Theme</Label>
            <Select value={settings.theme || 'system'} onValueChange={v => { setSettings({...settings, theme: v}); setTheme(v) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select>
          </div>
        </CardContent>
      </Card>
      <Card className="glass border-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><div><Label>Email notifications</Label><p className="text-xs text-muted-foreground">Interview reminders, follow-ups, new matches</p></div><Switch checked={settings.notifyEmail} onCheckedChange={v => setSettings({...settings, notifyEmail: v})} /></div>
          <div className="space-y-1.5 max-w-sm"><Label>Preferred location</Label><Input value={settings.locationPref || ''} onChange={e => setSettings({...settings, locationPref: e.target.value})} placeholder="e.g., San Francisco, CA" /></div>
        </CardContent>
      </Card>
      <Card className="glass border-0">
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>Account type</span><span className="font-medium">{user?.provider === 'google' ? 'Google OAuth' : 'Email/Password'}</span></div>
          <div className="flex items-center justify-between"><span>Plan</span><span className="font-medium">{user?.plan?.toUpperCase() || 'FREE'}</span></div>
          <div className="flex items-center justify-between"><span>Role</span><span className="font-medium">{user?.role?.toUpperCase() || 'USER'}</span></div>
        </CardContent>
      </Card>
      <SubscriptionCard user={user} onChange={u => setUser(u)} />
      <ChromeExtensionCard />
      <div className="sticky bottom-4"><Button onClick={save} size="lg" className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/30"><Save className="h-4 w-4 mr-2" />Save settings</Button></div>
    </div>
  )
}

function SubscriptionCard({ user, onChange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { fetch('/api/subscription').then(r => r.json()).then(setData) }, [])
  async function pick(planId) {
    setLoading(true)
    try {
      const r = await fetch('/api/subscription', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ plan: planId }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      toast.success(`Switched to ${planId.toUpperCase()} plan`)
      const me = await fetch('/api/auth/me').then(r => r.json()); onChange(me.user)
      setData({ ...data, current: planId })
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  if (!data) return null
  return (
    <Card className="glass border-0">
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Subscription</CardTitle><CardDescription>Choose the plan that fits your ambitions. Payment integration is disabled — you can switch plans freely in dev mode.</CardDescription></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-3">
          {data.plans.map(p => (
            <div key={p.id} className={`glass rounded-xl p-4 border-2 ${data.current === p.id ? 'border-primary' : 'border-transparent'}`}>
              <div className="flex items-center justify-between"><div className="font-bold text-lg">{p.name}</div>{data.current === p.id && <Badge>Current</Badge>}</div>
              <div className="text-3xl font-bold mt-2">${p.price}<span className="text-sm text-muted-foreground">/mo</span></div>
              <ul className="text-xs text-muted-foreground mt-3 space-y-1">{p.features.map((f, i) => <li key={i}>• {f}</li>)}</ul>
              <Button className="w-full mt-3" size="sm" variant={data.current === p.id ? 'outline' : 'default'} disabled={loading || data.current === p.id} onClick={() => pick(p.id)}>{data.current === p.id ? 'Current' : 'Switch to ' + p.name}</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ChromeExtensionCard() {
  return (
    <Card className="glass border-0">
      <CardHeader><CardTitle className="flex items-center gap-2"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M21.17 8H12" /><path d="M3.95 6.06L8.54 14" /><path d="M10.88 21.94L15.46 14" /></svg>Chrome Extension</CardTitle><CardDescription>Autofill applications & track jobs from any career site without leaving the page.</CardDescription></CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 flex-wrap">
          <Button asChild variant="outline"><a href="/careerpilot-extension.zip" download><Download className="h-4 w-4 mr-2" />Download extension</a></Button>
          <div className="text-xs text-muted-foreground">Unpack the zip → chrome://extensions → enable Developer mode → Load unpacked → point to the folder.</div>
        </div>
      </CardContent>
    </Card>
  )
}
