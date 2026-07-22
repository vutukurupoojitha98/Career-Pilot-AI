'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Mail, Sparkles, Copy, Download } from 'lucide-react'

export default function CoverLetterPage() {
  const [resumes, setResumes] = useState([])
  const [form, setForm] = useState({ resumeId: '', jobTitle: '', company: '', jobDescription: '', style: 'professional', tone: 'confident' })
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch('/api/resumes').then(r => r.json()).then(d => setResumes(d.resumes || []))
    fetch('/api/cover-letter/list').then(r => r.json()).then(d => setHistory(d.coverLetters || []))
  }, [])

  async function generate() {
    if (!form.jobTitle || !form.company) { toast.error('Job title and company required'); return }
    setLoading(true); setOutput(null)
    try {
      const res = await fetch('/api/cover-letter/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOutput(data.coverLetter)
      const h = await fetch('/api/cover-letter/list').then(r => r.json()); setHistory(h.coverLetters || [])
      toast.success('Cover letter generated!')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  function copy() { navigator.clipboard.writeText(output.content); toast.success('Copied to clipboard') }
  function download() {
    const blob = new Blob([output.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `cover-letter-${output.company}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cover Letters</h1>
        <p className="text-muted-foreground">AI-generated cover letters grounded in your resume.</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <Card className="glass border-0 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Generate a new letter</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Base resume</Label>
              <Select value={form.resumeId} onValueChange={v => setForm({...form, resumeId: v})}>
                <SelectTrigger><SelectValue placeholder="Choose resume for facts" /></SelectTrigger>
                <SelectContent>{resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Job title</Label><Input value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})} placeholder="Senior Engineer" /></div>
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Acme Inc." /></div>
            </div>
            <div className="space-y-1.5"><Label>Job description</Label><Textarea rows={5} value={form.jobDescription} onChange={e => setForm({...form, jobDescription: e.target.value})} placeholder="Paste JD for personalization" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Style</Label>
                <Select value={form.style} onValueChange={v => setForm({...form, style: v})}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="professional">Professional</SelectItem><SelectItem value="story-driven">Story-driven</SelectItem><SelectItem value="concise">Concise</SelectItem><SelectItem value="technical">Technical</SelectItem><SelectItem value="executive">Executive</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Tone</Label>
                <Select value={form.tone} onValueChange={v => setForm({...form, tone: v})}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="confident">Confident</SelectItem><SelectItem value="warm">Warm</SelectItem><SelectItem value="enthusiastic">Enthusiastic</SelectItem><SelectItem value="formal">Formal</SelectItem></SelectContent></Select>
              </div>
            </div>
            <Button onClick={generate} disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Writing…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate letter</>}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {output && (
            <Card className="glass-strong border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>{output.jobTitle} — {output.company}</CardTitle><CardDescription>{output.style} · {output.tone}</CardDescription></div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" />Copy</Button><Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4 mr-2" />Download</Button></div>
              </CardHeader>
              <CardContent><pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{output.content}</pre></CardContent>
            </Card>
          )}
          {history.length > 0 && (
            <Card className="glass border-0">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />Recent letters</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {history.slice(0, 8).map(h => (
                  <div key={h.id} onClick={() => setOutput(h)} className="p-3 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition">
                    <div className="font-medium text-sm">{h.jobTitle} — {h.company}</div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(h.createdAt).toLocaleDateString()} · {h.style}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
