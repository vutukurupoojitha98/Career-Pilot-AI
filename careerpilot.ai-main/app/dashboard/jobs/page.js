'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Loader2, MapPin, Building2, DollarSign, Briefcase, Target, ExternalLink, Bookmark, Sparkles, Globe, Clock } from 'lucide-react'

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'India', 'Australia', 'Singapore', 'Netherlands', 'France', 'Ireland', 'Remote (global)']

export default function JobsPage() {
  const [filters, setFilters] = useState({ title: '', keywords: '', country: 'United States', state: '', city: '', workMode: 'any', experience: 'any', salaryMin: '', visaSponsorship: false, resumeId: '' })
  const [live, setLive] = useState(true)
  const [jobs, setJobs] = useState([])
  const [bySource, setBySource] = useState({})
  const [loading, setLoading] = useState(false)
  const [resumes, setResumes] = useState([])
  const [selected, setSelected] = useState(null)
  const [match, setMatch] = useState(null)
  const [matching, setMatching] = useState(false)

  useEffect(() => { fetch('/api/resumes').then(r => r.json()).then(d => setResumes(d.resumes || [])) }, [])

  async function search() {
    setLoading(true); setJobs([]); setBySource({})
    try {
      const url = live ? '/api/jobs/live-search' : '/api/jobs/search'
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(filters) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setJobs(data.jobs || [])
      setBySource(data.bySource || {})
      toast.success(`Found ${data.jobs?.length || 0} jobs${live ? ' (live)' : ' (AI)'}`)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function openMatch(job) {
    setSelected(job); setMatch(null)
    if (filters.resumeId) {
      setMatching(true)
      try {
        const res = await fetch('/api/jobs/match', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ resumeId: filters.resumeId, job }) })
        const data = await res.json(); setMatch(data.match)
      } catch (e) { toast.error(e.message) } finally { setMatching(false) }
    }
  }

  async function saveJob(job) {
    await fetch('/api/jobs/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ job }) })
    toast.success('Job saved')
  }

  async function trackJob(job) {
    await fetch('/api/applications', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ jobTitle: job.title, company: job.company, location: job.location, salary: `${job.currency} ${job.salaryMin}-${job.salaryMax}`, link: job.applyUrl, status: 'applied' }) })
    toast.success('Added to application tracker')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Search</h1>
        <p className="text-muted-foreground">AI-powered search across Greenhouse, Lever, Ashby, Wellfound, RemoteOK & company sites.</p>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setLive(true)} className={`px-3 py-1 rounded-full text-xs font-medium ${live ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>🔴 Live boards</button>
          <button onClick={() => setLive(false)} className={`px-3 py-1 rounded-full text-xs font-medium ${!live ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>✨ AI generated</button>
          {Object.keys(bySource).length > 0 && <span className="text-xs text-muted-foreground ml-2">{Object.entries(bySource).map(([k,v]) => `${k}: ${v}`).join(' · ')}</span>}
        </div>
      </div>

      <Card className="glass border-0">
        <CardContent className="p-5 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Job title / keywords</Label><Input value={filters.title} onChange={e => setFilters({...filters, title: e.target.value})} placeholder="Senior Backend Engineer" /></div>
            <div className="space-y-1.5"><Label>Extra keywords</Label><Input value={filters.keywords} onChange={e => setFilters({...filters, keywords: e.target.value})} placeholder="Python, Kubernetes" /></div>
            <div className="space-y-1.5"><Label>Match to resume</Label>
              <Select value={filters.resumeId} onValueChange={v => setFilters({...filters, resumeId: v})}>
                <SelectTrigger><SelectValue placeholder="Optional — for match scores" /></SelectTrigger>
                <SelectContent>{resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label>Country</Label>
              <Select value={filters.country} onValueChange={v => setFilters({...filters, country: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>State/Region</Label><Input value={filters.state} onChange={e => setFilters({...filters, state: e.target.value})} placeholder="California" /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})} placeholder="San Francisco" /></div>
            <div className="space-y-1.5"><Label>Work mode</Label>
              <Select value={filters.workMode} onValueChange={v => setFilters({...filters, workMode: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Any</SelectItem><SelectItem value="remote">Remote</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="onsite">Onsite</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5"><Label>Experience</Label>
              <Select value={filters.experience} onValueChange={v => setFilters({...filters, experience: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Any</SelectItem><SelectItem value="entry">Entry</SelectItem><SelectItem value="mid">Mid</SelectItem><SelectItem value="senior">Senior</SelectItem><SelectItem value="staff">Staff+</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Min salary</Label><Input value={filters.salaryMin} onChange={e => setFilters({...filters, salaryMin: e.target.value})} placeholder="120000" /></div>
            <div className="flex items-center gap-2 self-end pb-2"><Checkbox id="visa" checked={filters.visaSponsorship} onCheckedChange={v => setFilters({...filters, visaSponsorship: !!v})} /><Label htmlFor="visa">Visa sponsorship</Label></div>
            <Button onClick={search} disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />} Search jobs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {jobs.map((job, i) => (
          <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="glass border-0 hover-lift cursor-pointer" onClick={() => openMatch(job)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white font-bold text-lg shrink-0">{job.companyLogo || job.company?.slice(0,2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-lg">{job.title}</div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                          <Badge variant="outline" className="text-[10px]">{job.workMode}</Badge>
                          <Badge variant="outline" className="text-[10px]">{job.experience}</Badge>
                          {job.visaSponsorship && <Badge variant="secondary" className="text-[10px]">Visa OK</Badge>}
                        </div>
                      </div>
                      {job.matchScore > 0 && <div className="text-center shrink-0"><div className="text-2xl font-bold gradient-text">{job.matchScore}%</div><div className="text-[10px] text-muted-foreground">match</div></div>}
                    </div>
                    <div className="flex items-center gap-3 text-sm mt-3 flex-wrap">
                      <span className="flex items-center gap-1 text-emerald-500 font-medium"><DollarSign className="h-3.5 w-3.5" />{job.currency} {job.salaryMin?.toLocaleString?.() || job.salaryMin} – {job.salaryMax?.toLocaleString?.() || job.salaryMax}</span>
                      <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{job.postedDaysAgo}d ago · {job.source}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">{job.skills?.slice(0, 6).map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{selected.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-3 flex-wrap">
                <span>{selected.company}</span>·<span>{selected.location}</span>·<Badge variant="outline">{selected.workMode}</Badge>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="text-sm"><DollarSign className="h-3 w-3 mr-1" />{selected.currency} {selected.salaryMin?.toLocaleString?.()}–{selected.salaryMax?.toLocaleString?.()}</Badge>
                <Badge variant="outline"><Briefcase className="h-3 w-3 mr-1" />{selected.experience}</Badge>
                {selected.visaSponsorship && <Badge variant="secondary">Visa sponsorship</Badge>}
                <Badge variant="outline">Source: {selected.source}</Badge>
              </div>
              {matching && <div className="glass rounded-xl p-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Analyzing match with your resume…</div>}
              {match && (
                <div className="glass-strong rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" />AI Match Analysis</div>
                    <div className="text-3xl font-black gradient-text">{match.matchScore}%</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{match.reason}</p>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div><div className="font-medium text-emerald-600 mb-1">Strengths</div><ul className="space-y-1">{match.strengths?.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
                    <div><div className="font-medium text-orange-600 mb-1">Skill gaps</div><ul className="space-y-1">{match.skillGaps?.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
                  </div>
                  <div className="text-sm"><div className="font-medium mb-1">To improve your match:</div><ul className="space-y-1">{match.improvements?.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
                </div>
              )}
              <div><div className="font-semibold mb-2">About the role</div><div className="text-sm text-muted-foreground whitespace-pre-line">{selected.description}</div></div>
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button onClick={() => saveJob(selected)} variant="outline"><Bookmark className="h-4 w-4 mr-2" />Save</Button>
                <Button onClick={() => trackJob(selected)} variant="outline"><Briefcase className="h-4 w-4 mr-2" />Add to tracker</Button>
                <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"><a href={selected.applyUrl} target="_blank" rel="noopener">Apply <ExternalLink className="h-4 w-4 ml-2" /></a></Button>
              </div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
