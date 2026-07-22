'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Sparkles, Brain, TrendingUp, GraduationCap, Building2, Target, AlertTriangle, DollarSign, RefreshCw, MapPin, ExternalLink, MessageCircle, Bookmark } from 'lucide-react'

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'India', 'Australia', 'Singapore', 'Netherlands', 'France', 'Ireland']

export default function CopilotPage() {
  const [resumes, setResumes] = useState([])
  const [resumeId, setResumeId] = useState('')
  const [country, setCountry] = useState('United States')
  const [scan, setScan] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState({ scan: false, discover: false, prep: false })
  const [prepOpen, setPrepOpen] = useState(false)
  const [prep, setPrep] = useState(null)
  const [prepInput, setPrepInput] = useState({ jobTitle: '', company: '', jobDescription: '' })

  useEffect(() => {
    fetch('/api/resumes').then(r => r.json()).then(d => { setResumes(d.resumes || []); if (d.resumes?.[0]) setResumeId(d.resumes[0].id) })
    fetch('/api/copilot/discovered').then(r => r.json()).then(d => setJobs(d.jobs || []))
    fetch('/api/copilot/scans').then(r => r.json()).then(d => { if (d.scans?.[0]) setScan(d.scans[0]) })
  }, [])

  async function runScan() {
    if (!resumeId) return toast.error('Choose a resume first')
    setLoading(l => ({ ...l, scan: true }))
    try {
      const r = await fetch('/api/copilot/scan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ resumeId, country }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setScan(d.scan); toast.success('Career analysis ready')
    } catch (e) { toast.error(e.message) } finally { setLoading(l => ({ ...l, scan: false })) }
  }

  async function discover() {
    if (!resumeId) return toast.error('Choose a resume first')
    setLoading(l => ({ ...l, discover: true }))
    try {
      const r = await fetch('/api/copilot/discover', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ resumeId, country }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      const list = await fetch('/api/copilot/discovered').then(r => r.json()); setJobs(list.jobs || [])
      toast.success(`Discovered ${d.count} new opportunities`)
    } catch (e) { toast.error(e.message) } finally { setLoading(l => ({ ...l, discover: false })) }
  }

  async function runPrep() {
    if (!prepInput.jobTitle) return toast.error('Job title required')
    setLoading(l => ({ ...l, prep: true })); setPrep(null)
    try {
      const r = await fetch('/api/copilot/interview-prep', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ resumeId, ...prepInput }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error); setPrep(d.prep)
    } catch (e) { toast.error(e.message) } finally { setLoading(l => ({ ...l, prep: false })) }
  }

  const i = scan?.insights

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Brain className="h-8 w-8 text-primary" />AI Career Copilot</h1>
          <p className="text-muted-foreground">Your always-on strategist — analyzes you, discovers jobs, plans your growth.</p>
        </div>
      </div>

      <Card className="glass-strong border-0">
        <CardContent className="p-5">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5"><Label>Resume</Label>
              <Select value={resumeId} onValueChange={setResumeId}><SelectTrigger><SelectValue placeholder="Choose resume" /></SelectTrigger><SelectContent>{resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Target country</Label>
              <Select value={country} onValueChange={setCountry}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={runScan} disabled={loading.scan} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white flex-1">{loading.scan ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</> : <><Sparkles className="h-4 w-4 mr-2" />Analyze me</>}</Button>
              <Button onClick={discover} disabled={loading.discover} variant="outline">{loading.discover ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {i && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="glass border-0">
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Career trajectory</CardTitle><CardDescription>Level: {i.careerLevel}</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><div className="font-medium mb-2">Ideal next roles</div><div className="flex flex-wrap gap-1.5">{i.ideal_next_roles?.map((r, k) => <Badge key={k} variant="secondary">{r}</Badge>)}</div></div>
              <div><div className="font-medium mb-2">Target companies</div><div className="flex flex-wrap gap-1.5">{i.target_companies?.map((c, k) => <Badge key={k} variant="outline">{c}</Badge>)}</div></div>
            </CardContent>
          </Card>
          <Card className="glass border-0">
            <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-emerald-500" />Market view</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {i.estimated_salary_range && <div className="glass rounded-lg p-3"><div className="text-xs text-muted-foreground">Estimated salary</div><div className="text-2xl font-bold gradient-text">{i.estimated_salary_range.currency} {i.estimated_salary_range.min?.toLocaleString?.() || i.estimated_salary_range.min} – {i.estimated_salary_range.max?.toLocaleString?.() || i.estimated_salary_range.max}</div><div className="text-xs text-muted-foreground">{i.estimated_salary_range.note}</div></div>}
              <div className="text-muted-foreground">{i.market_insights}</div>
            </CardContent>
          </Card>
          <Card className="glass border-0">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-orange-500" />Skills to level up</CardTitle></CardHeader>
            <CardContent className="space-y-2"><div className="space-y-2">{i.skills_to_learn?.map((s, k) => (
              <div key={k} className="glass rounded-lg p-3">
                <div className="flex items-center justify-between"><div className="font-medium">{s.skill}</div><Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'secondary'}>{s.priority}</Badge></div>
                <div className="text-xs text-muted-foreground mt-1">{s.why}</div>
                {s.resource && <div className="text-xs text-primary mt-1">📚 {s.resource}</div>}
              </div>
            ))}</div></CardContent>
          </Card>
          <Card className="glass border-0">
            <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-purple-500" />Certifications</CardTitle></CardHeader>
            <CardContent className="space-y-2">{i.certifications_recommended?.map((c, k) => (
              <div key={k} className="glass rounded-lg p-3"><div className="flex items-center justify-between"><div className="font-medium">{c.name}</div><Badge variant="outline">{c.provider}</Badge></div><div className="text-xs text-muted-foreground mt-1">{c.why}</div><div className="text-xs mt-1">Est. cost: {c.cost_estimate}</div></div>
            ))}</CardContent>
          </Card>
          {i.red_flags?.length > 0 && (
            <Card className="glass border-0 md:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />Red flags to address</CardTitle></CardHeader>
              <CardContent><ul className="space-y-1 text-sm">{i.red_flags.map((r, k) => <li key={k} className="flex gap-2"><span className="text-red-500">⚠</span>{r}</li>)}</ul></CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Continuous job discoveries</h2>
          <Button variant="outline" size="sm" onClick={discover} disabled={loading.discover}>{loading.discover ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}Discover more</Button>
        </div>
        {jobs.length === 0 ? <div className="text-sm text-muted-foreground glass rounded-xl p-8 text-center">No discoveries yet. Click "Discover more" to find fresh matches.</div> : (
          <div className="grid gap-3">
            {jobs.map(job => (
              <Card key={job.id} className="glass border-0 hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white font-bold shrink-0">{job.companyLogo || job.company?.slice(0,2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div><div className="font-semibold">{job.title}</div><div className="text-sm text-muted-foreground">{job.company} · <MapPin className="inline h-3 w-3" /> {job.location}</div></div>
                        <div className="text-center shrink-0"><div className="text-xl font-bold gradient-text">{job.matchScore}%</div><div className="text-[10px] text-muted-foreground">match</div></div>
                      </div>
                      <div className="text-xs text-emerald-600 mt-2 italic">🧭 {job.matchReason}</div>
                      <div className="flex flex-wrap gap-1 mt-2">{job.skills?.slice(0, 6).map((s, k) => <Badge key={k} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => { setPrepInput({ jobTitle: job.title, company: job.company, jobDescription: job.description }); setPrepOpen(true); setPrep(null) }}><MessageCircle className="h-3 w-3 mr-1" />Interview prep</Button>
                        <Button size="sm" variant="outline" asChild><a href={job.applyUrl} target="_blank" rel="noopener"><ExternalLink className="h-3 w-3 mr-1" />Apply</a></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={prepOpen} onOpenChange={setPrepOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Personalized interview prep</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Job title</Label><Input value={prepInput.jobTitle} onChange={e => setPrepInput({...prepInput, jobTitle: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Company</Label><Input value={prepInput.company} onChange={e => setPrepInput({...prepInput, company: e.target.value})} /></div>
            </div>
            <div className="space-y-1.5"><Label>Job description</Label><Textarea rows={4} value={prepInput.jobDescription} onChange={e => setPrepInput({...prepInput, jobDescription: e.target.value})} /></div>
            <Button onClick={runPrep} disabled={loading.prep} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{loading.prep ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate prep plan</>}</Button>
            {prep && (
              <div className="glass rounded-xl p-4 space-y-4 text-sm">
                <div><div className="font-semibold mb-2">Focus topics</div><div className="flex flex-wrap gap-1.5">{prep.focus_topics?.map((t, k) => <Badge key={k}>{t}</Badge>)}</div></div>
                <div><div className="font-semibold mb-1">Your pitch</div><p className="text-muted-foreground">{prep.pitch_advice}</p></div>
                <div><div className="font-semibold mb-2">Likely questions</div><ul className="space-y-2">{prep.likely_questions?.map((q, k) => <li key={k} className="glass p-2 rounded"><Badge variant="outline" className="mr-2 text-[10px]">{q.category}</Badge>{q.question}<div className="text-xs text-muted-foreground mt-1">{q.why}</div></li>)}</ul></div>
                {prep.study_plan_week && <div><div className="font-semibold mb-2">7-day plan</div><div className="space-y-2">{prep.study_plan_week.map((d, k) => <div key={k} className="glass p-2 rounded"><div className="font-medium text-xs">Day {d.day}</div><ul className="text-xs text-muted-foreground mt-1">{d.tasks?.map((t, i) => <li key={i}>• {t}</li>)}</ul></div>)}</div></div>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
