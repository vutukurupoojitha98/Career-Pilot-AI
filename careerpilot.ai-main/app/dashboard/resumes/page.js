'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Upload, FileText, Trash2, Sparkles, Loader2, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, Zap, Wand2, History, Target, DollarSign, Download, FileDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu'

export default function ResumesPage() {
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [targetRole, setTargetRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [versions, setVersions] = useState([])
  const [optimized, setOptimized] = useState(null)
  const [optimizedOpen, setOptimizedOpen] = useState(false)
  const fileInput = useRef(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/resumes').then(r => r.json())
    setResumes(r.resumes || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function loadVersions(id) {
    const r = await fetch(`/api/resumes/${id}/versions`).then(r => r.json())
    setVersions(r.versions || [])
  }

  async function uploadFile(file) {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/resumes/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      toast.success('Resume parsed successfully!')
      await load()
      setSelected(data.resume)
    } catch (e) { toast.error(e.message) } finally { setUploading(false) }
  }

  async function analyze() {
    if (!selected) return
    setAnalyzing(true); setAnalysis(null)
    try {
      const res = await fetch(`/api/resumes/${selected.id}/analyze`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ targetRole, jobDescription: jobDesc }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setAnalysis(data.analysis)
      toast.success(`ATS Score: ${data.analysis.atsScore}/100`)
      await load()
    } catch (e) { toast.error(e.message) } finally { setAnalyzing(false) }
  }

  async function optimize() {
    if (!selected) return
    setOptimizing(true); setOptimized(null)
    try {
      const res = await fetch(`/api/resumes/${selected.id}/optimize`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ targetRole, jobDescription: jobDesc }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Optimize failed')
      setOptimized(data.optimized)
      setOptimizedOpen(true)
      toast.success('Resume optimized — saved as new version')
      await loadVersions(selected.id)
    } catch (e) { toast.error(e.message) } finally { setOptimizing(false) }
  }

  async function del(id) {
    if (!confirm('Delete this resume?')) return
    await fetch(`/api/resumes/${id}`, { method: 'DELETE' })
    if (selected?.id === id) { setSelected(null); setAnalysis(null) }
    load()
    toast.success('Deleted')
  }

  function selectResume(r) { setSelected(r); setAnalysis(r.lastAnalysis || null); loadVersions(r.id) }

  async function exportResume(format, template, versionId = null) {
    if (!selected) return
    const url = `/api/resumes/${selected.id}/export`
    try {
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ format, template, versionId }) })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Export failed') }
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'docx' ? 'docx' : 'pdf'
      a.href = dlUrl; a.download = `${(selected.parsed?.name || 'resume').replace(/\s+/g,'_')}_${template}.${ext}`; a.click()
      URL.revokeObjectURL(dlUrl)
      toast.success(`Exported as ${format.toUpperCase()} (${template} template)`)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resumes</h1>
          <p className="text-muted-foreground">Upload, analyze, and optimize with AI.</p>
        </div>
        <div>
          <input ref={fileInput} type="file" accept=".pdf,.docx" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          <Button onClick={() => fileInput.current?.click()} disabled={uploading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Upload resume
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* List */}
        <Card className="glass border-0 h-fit">
          <CardHeader className="pb-3"><CardTitle className="text-base">Your resumes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : resumes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto opacity-40 mb-2" />No resumes yet.
              </div>
            ) : resumes.map(r => (
              <div key={r.id} onClick={() => selectResume(r)} className={`p-3 rounded-lg border cursor-pointer transition ${selected?.id === r.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  {r.atsScore && <Badge className="shrink-0" variant={r.atsScore >= 80 ? 'default' : r.atsScore >= 60 ? 'secondary' : 'destructive'}>{r.atsScore}</Badge>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); del(r.id) }} className="text-xs text-muted-foreground hover:text-destructive mt-2 flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Detail */}
        {!selected ? (
          <Card className="glass-strong border-0">
            <CardContent className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center mx-auto mb-4"><Upload className="h-6 w-6 text-white" /></div>
              <h3 className="text-xl font-semibold mb-2">Upload your first resume</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">Drop a PDF or DOCX — our AI parses it into structured data and gives you an ATS score in seconds.</p>
              <Button onClick={() => fileInput.current?.click()} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">Choose file</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="glass border-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />{selected.title}</CardTitle>
                    <CardDescription>{selected.parsed?.email} · {selected.parsed?.skills?.slice(0,5).join(', ')}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Export as PDF</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => exportResume('pdf', 'classic')}>Classic template</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResume('pdf', 'modern')}>Modern template</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResume('pdf', 'minimal')}>Minimal template</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Export as DOCX</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => exportResume('docx', 'classic')}>Classic template</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResume('docx', 'modern')}>Modern template</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResume('docx', 'minimal')}>Minimal template</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="analyze" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="analyze">ATS Analyze</TabsTrigger>
                    <TabsTrigger value="optimize">AI Optimize</TabsTrigger>
                    <TabsTrigger value="parsed">Parsed Data</TabsTrigger>
                    <TabsTrigger value="versions">Versions</TabsTrigger>
                  </TabsList>

                  {/* Analyze */}
                  <TabsContent value="analyze" className="space-y-4 pt-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Target role (optional)</Label><Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Senior Backend Engineer" /></div>
                      <div className="space-y-1.5"><Label>Job description (optional)</Label><Input value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste key requirements" /></div>
                    </div>
                    <Button onClick={analyze} disabled={analyzing} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                      {analyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing with AI…</> : <><Sparkles className="h-4 w-4 mr-2" />Run ATS Analysis</>}
                    </Button>
                    {analysis && <AnalysisView analysis={analysis} />}
                  </TabsContent>

                  {/* Optimize */}
                  <TabsContent value="optimize" className="space-y-4 pt-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label>Target role</Label><Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Senior Backend Engineer" /></div>
                      <div className="space-y-1.5"><Label>Paste job description (optional)</Label><Textarea rows={6} value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the JD to tailor the resume without inventing anything." /></div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />AI will only use facts from your existing resume — no invented experience.
                      </div>
                      <Button onClick={optimize} disabled={optimizing} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                        {optimizing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Optimizing…</> : <><Wand2 className="h-4 w-4 mr-2" />Generate optimized version</>}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Parsed */}
                  <TabsContent value="parsed" className="pt-4">
                    <ParsedView data={selected.parsed} />
                  </TabsContent>

                  {/* Versions */}
                  <TabsContent value="versions" className="pt-4 space-y-2">
                    {versions.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6"><History className="h-6 w-6 mx-auto opacity-40 mb-2" />No versions yet. Optimize your resume to create one.</div> : versions.map(v => (
                      <div key={v.id} className="glass rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{v.label}</div>
                          <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setOptimized(v.parsed); setOptimizedOpen(true) }}>View</Button>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Optimized dialog */}
      <Dialog open={optimizedOpen} onOpenChange={setOptimizedOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Optimized resume</DialogTitle><DialogDescription>Grounded in your original facts. Copy or export from below.</DialogDescription></DialogHeader>
          {optimized && <div className="space-y-4">
            {optimized.changeLog?.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="font-semibold mb-2 flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" />What changed</div>
                <ul className="text-sm space-y-1 list-disc pl-5">{optimized.changeLog.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
            <ParsedView data={optimized} />
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AnalysisView({ analysis }) {
  const scoreColor = analysis.atsScore >= 80 ? 'text-emerald-500' : analysis.atsScore >= 60 ? 'text-orange-500' : 'text-red-500'
  const scores = [
    { label: 'ATS', value: analysis.atsScore },
    { label: 'Grammar', value: analysis.grammarScore },
    { label: 'Formatting', value: analysis.formattingScore },
    { label: 'Keywords', value: analysis.keywordScore },
    { label: 'Recruiter Appeal', value: analysis.recruiterFriendliness },
  ]
  return (
    <div className="space-y-6 mt-4">
      <div className="glass-strong rounded-2xl p-6 text-center">
        <div className="text-sm text-muted-foreground mb-2">Overall ATS Score</div>
        <div className={`text-6xl font-black ${scoreColor}`}>{analysis.atsScore}<span className="text-2xl text-muted-foreground">/100</span></div>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{analysis.overallSummary}</p>
      </div>
      <div className="grid md:grid-cols-5 gap-3">
        {scores.map(s => (
          <div key={s.label} className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <Progress value={s.value} className="h-1.5 mt-2" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="font-semibold text-emerald-600 flex items-center gap-2 mb-3"><CheckCircle2 className="h-4 w-4" />Strengths</div>
          <ul className="space-y-2 text-sm">{analysis.strengths?.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span>{s}</li>)}</ul>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="font-semibold text-orange-600 flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4" />Areas to improve</div>
          <ul className="space-y-2 text-sm">{analysis.weaknesses?.map((s, i) => <li key={i} className="flex gap-2"><span className="text-orange-500">•</span>{s}</li>)}</ul>
        </div>
      </div>
      {analysis.weakBullets?.length > 0 && (
        <div className="glass rounded-xl p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" />Weak bullet rewrites</div>
          <div className="space-y-3">
            {analysis.weakBullets.map((b, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-2 text-sm">
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"><div className="text-xs text-red-500 mb-1">Original</div>{b.original}</div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20"><div className="text-xs text-emerald-500 mb-1">Improved</div>{b.improved}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {analysis.missingKeywords?.length > 0 && (
          <div className="glass rounded-xl p-5">
            <div className="font-semibold mb-3">Missing keywords</div>
            <div className="flex flex-wrap gap-2">{analysis.missingKeywords.map((k, i) => <Badge key={i} variant="outline">{k}</Badge>)}</div>
          </div>
        )}
        {analysis.salaryEstimate && (
          <div className="glass rounded-xl p-5">
            <div className="font-semibold flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-emerald-500" />Estimated salary</div>
            <div className="text-2xl font-bold">{analysis.salaryEstimate.currency} {analysis.salaryEstimate.minAnnual?.toLocaleString?.() || analysis.salaryEstimate.minAnnual} — {analysis.salaryEstimate.maxAnnual?.toLocaleString?.() || analysis.salaryEstimate.maxAnnual}</div>
            <div className="text-xs text-muted-foreground mt-2">{analysis.salaryEstimate.note}</div>
          </div>
        )}
      </div>
      {analysis.suggestions?.length > 0 && (
        <div className="glass rounded-xl p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" />Action items</div>
          <ol className="space-y-2 text-sm list-decimal pl-5">{analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}
    </div>
  )
}

function ParsedView({ data }) {
  if (!data) return <div className="text-muted-foreground">No data</div>
  return (
    <div className="space-y-4 text-sm">
      <div className="glass rounded-xl p-4">
        <div className="font-semibold text-lg">{data.name}</div>
        <div className="text-muted-foreground text-xs mt-1">{[data.email, data.phone, data.location].filter(Boolean).join(' · ')}</div>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.linkedin && <Badge variant="outline">LinkedIn</Badge>}
          {data.github && <Badge variant="outline">GitHub</Badge>}
          {data.portfolio && <Badge variant="outline">Portfolio</Badge>}
        </div>
      </div>
      {data.summary && <div className="glass rounded-xl p-4"><div className="font-semibold mb-1">Summary</div><p className="text-muted-foreground">{data.summary}</p></div>}
      {data.skills?.length > 0 && <div className="glass rounded-xl p-4"><div className="font-semibold mb-2">Skills</div><div className="flex flex-wrap gap-1.5">{data.skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}</div></div>}
      {data.experience?.length > 0 && <div className="glass rounded-xl p-4"><div className="font-semibold mb-3">Experience</div><div className="space-y-4">{data.experience.map((e, i) => (
        <div key={i} className="border-l-2 border-primary/30 pl-4">
          <div className="font-medium">{e.title} — {e.company}</div>
          <div className="text-xs text-muted-foreground">{e.startDate} — {e.current ? 'Present' : e.endDate}{e.location ? ' · ' + e.location : ''}</div>
          {e.bullets?.length > 0 && <ul className="list-disc pl-4 mt-2 space-y-1 text-muted-foreground">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
        </div>
      ))}</div></div>}
      {data.projects?.length > 0 && <div className="glass rounded-xl p-4"><div className="font-semibold mb-3">Projects</div><div className="space-y-3">{data.projects.map((p, i) => (
        <div key={i}><div className="font-medium">{p.name}</div><div className="text-muted-foreground">{p.description}</div>{p.tech && <div className="flex flex-wrap gap-1 mt-1">{p.tech.map((t, j) => <Badge key={j} variant="outline" className="text-[10px]">{t}</Badge>)}</div>}</div>
      ))}</div></div>}
      {data.education?.length > 0 && <div className="glass rounded-xl p-4"><div className="font-semibold mb-3">Education</div><div className="space-y-2">{data.education.map((e, i) => (
        <div key={i}><div className="font-medium">{e.degree} — {e.school}</div><div className="text-xs text-muted-foreground">{e.startDate} — {e.endDate}{e.location ? ' · ' + e.location : ''}</div></div>
      ))}</div></div>}
      {data.certifications?.length > 0 && <div className="glass rounded-xl p-4"><div className="font-semibold mb-2">Certifications</div><ul className="space-y-1">{data.certifications.map((c, i) => <li key={i}>• {c.name} — {c.issuer} ({c.date})</li>)}</ul></div>}
    </div>
  )
}
