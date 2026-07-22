'use client'
import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Mic, MicOff, Sparkles, ArrowLeft, ArrowRight, Trophy, Code2, Building2, Users2, Cpu, Brain, MessageCircle, BookOpen } from 'lucide-react'

const CATEGORIES = [
  { key: 'hr', label: 'HR / General', icon: Users2, color: 'from-blue-500 to-cyan-500' },
  { key: 'behavioral', label: 'Behavioral', icon: MessageCircle, color: 'from-purple-500 to-pink-500' },
  { key: 'technical', label: 'Technical', icon: Brain, color: 'from-indigo-500 to-purple-600' },
  { key: 'coding', label: 'Coding', icon: Code2, color: 'from-emerald-500 to-teal-500' },
  { key: 'system-design', label: 'System Design', icon: Cpu, color: 'from-orange-500 to-red-500' },
  { key: 'managerial', label: 'Managerial', icon: Building2, color: 'from-amber-500 to-orange-500' },
]

export default function InterviewCoachPage() {
  const [category, setCategory] = useState('behavioral')
  const [session, setSession] = useState(null) // {questions, current, answers}
  const [config, setConfig] = useState({ jobTitle: '', jobDescription: '', difficulty: 'medium', count: 5 })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)

  useEffect(() => { fetch('/api/interview/sessions').then(r => r.json()).then(d => setProgress(d.sessions || [])) }, [])

  async function start() {
    setLoading(true)
    try {
      if (category === 'coding') {
        const res = await fetch('/api/interview/coding', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ difficulty: config.difficulty }) })
        const data = await res.json()
        setSession({ mode: 'coding', problem: data.problem, code: '', feedback: null })
      } else if (category === 'system-design') {
        const res = await fetch('/api/interview/system-design', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ difficulty: config.difficulty }) })
        const data = await res.json()
        setSession({ mode: 'system-design', problem: data.problem, answer: '', feedback: null })
      } else {
        const res = await fetch('/api/interview/questions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ category, ...config }) })
        const data = await res.json()
        setSession({ mode: 'qa', category, questions: data.questions, current: 0, answers: {}, evaluations: {} })
      }
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function evaluateQA() {
    const q = session.questions[session.current]
    const ans = session.answers[q.id] || ''
    if (!ans.trim()) { toast.error('Provide an answer first'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/interview/evaluate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: q.question, answer: ans, category: session.category, jobTitle: config.jobTitle }) })
      const data = await res.json()
      setSession({ ...session, evaluations: { ...session.evaluations, [q.id]: data.evaluation } })
      toast.success(`Score: ${data.evaluation.overallScore}/100`)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function evaluateCoding() {
    if (!session.code.trim()) { toast.error('Write some code first'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/interview/coding/evaluate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ problem: session.problem, code: session.code }) })
      const data = await res.json()
      setSession({ ...session, feedback: data.evaluation })
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function evaluateSystemDesign() {
    if (!session.answer.trim()) { toast.error('Provide an answer first'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/interview/system-design', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: session.problem?.title, answer: session.answer }) })
      const data = await res.json()
      setSession({ ...session, feedback: data.evaluation })
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  async function saveSession() {
    if (!session) return
    const summary = session.mode === 'qa' ? {
      questionCount: session.questions.length,
      avgScore: Object.values(session.evaluations).length ? Math.round(Object.values(session.evaluations).reduce((s, e) => s + (e.overallScore || 0), 0) / Object.values(session.evaluations).length) : 0,
    } : { score: session.feedback?.overallScore || 0 }
    await fetch('/api/interview/session', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ category, mode: session.mode, jobTitle: config.jobTitle, summary, data: session }) })
    const d = await fetch('/api/interview/sessions').then(r => r.json()); setProgress(d.sessions || [])
    toast.success('Session saved')
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Coach</h1>
          <p className="text-muted-foreground">Practice with AI-powered mock interviews.</p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)} className={`glass rounded-2xl p-5 text-left hover-lift transition ${category === c.key ? 'ring-2 ring-primary' : ''}`}>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} grid place-items-center mb-3`}><c.icon className="h-5 w-5 text-white" /></div>
              <div className="font-semibold">{c.label}</div>
            </button>
          ))}
        </div>
        <Card className="glass border-0">
          <CardHeader><CardTitle>Configure your session</CardTitle><CardDescription>Selected: {CATEGORIES.find(c => c.key === category)?.label}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Target role</Label><Input value={config.jobTitle} onChange={e => setConfig({...config, jobTitle: e.target.value})} placeholder="e.g., Senior Backend Engineer" /></div>
              <div className="space-y-1.5"><Label>Difficulty</Label>
                <Select value={config.difficulty} onValueChange={v => setConfig({...config, difficulty: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
              </div>
            </div>
            {!['coding','system-design'].includes(category) && <div className="space-y-1.5"><Label>Job description (optional)</Label><Textarea rows={3} value={config.jobDescription} onChange={e => setConfig({...config, jobDescription: e.target.value})} placeholder="Paste for better questions" /></div>}
            <Button onClick={start} disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing…</> : <><Sparkles className="h-4 w-4 mr-2" />Start session</>}</Button>
          </CardContent>
        </Card>

        {progress?.length > 0 && (
          <Card className="glass border-0">
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Recent sessions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {progress.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div><div className="font-medium text-sm">{CATEGORIES.find(c => c.key === s.category)?.label || s.category} {s.jobTitle ? '— ' + s.jobTitle : ''}</div><div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div></div>
                  <Badge className="text-lg font-bold" variant={s.summary?.avgScore >= 80 || s.summary?.score >= 80 ? 'default' : 'secondary'}>{s.summary?.avgScore || s.summary?.score || 0}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <ProgressSummary />
        <LearningPlanCard />
      </div>
    )
  }

  // Session active
  if (session.mode === 'coding') return <CodingSession session={session} setSession={setSession} evaluate={evaluateCoding} loading={loading} onExit={() => { saveSession(); setSession(null) }} />
  if (session.mode === 'system-design') return <SystemDesignSession session={session} setSession={setSession} evaluate={evaluateSystemDesign} loading={loading} onExit={() => { saveSession(); setSession(null) }} />
  return <QASession session={session} setSession={setSession} evaluate={evaluateQA} loading={loading} onExit={() => { saveSession(); setSession(null) }} />
}

function QASession({ session, setSession, evaluate, loading, onExit }) {
  const q = session.questions[session.current]
  const ans = session.answers[q.id] || ''
  const evalRes = session.evaluations[q.id]
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef(null)

  function toggleMic() {
    const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
    if (!SR) { toast.error('Speech recognition not supported in this browser'); return }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-US'
    r.onresult = e => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + ' '
      setSession(s => ({ ...s, answers: { ...s.answers, [q.id]: (s.answers[q.id] || '') + ' ' + text } }))
    }
    r.onerror = () => setRecording(false)
    r.onend = () => setRecording(false)
    recognitionRef.current = r; r.start(); setRecording(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{session.category?.toUpperCase()} Mock Interview</h1><p className="text-sm text-muted-foreground">Question {session.current + 1} of {session.questions.length}</p></div>
        <Button variant="outline" onClick={onExit}>End session</Button>
      </div>
      <Progress value={((session.current) / session.questions.length) * 100} />
      <Card className="glass-strong border-0">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2"><Badge>{q.difficulty}</Badge><Badge variant="outline">{q.category}</Badge></div>
          <CardTitle className="text-xl leading-tight">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Your answer</Label>
              <Button size="sm" variant={recording ? 'destructive' : 'outline'} onClick={toggleMic}>{recording ? <><MicOff className="h-3 w-3 mr-1" />Stop</> : <><Mic className="h-3 w-3 mr-1" />Voice input</>}</Button>
            </div>
            <Textarea rows={6} value={ans} onChange={e => setSession(s => ({ ...s, answers: { ...s.answers, [q.id]: e.target.value } }))} placeholder="Type or dictate your answer…" />
          </div>
          {q.tips?.length > 0 && !evalRes && (
            <div className="glass rounded-xl p-4 text-sm"><div className="font-medium mb-2">💡 Tips</div><ul className="space-y-1 text-muted-foreground">{q.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul></div>
          )}
          {evalRes && <EvalView e={evalRes} />}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={session.current === 0} onClick={() => setSession(s => ({ ...s, current: s.current - 1 }))}><ArrowLeft className="h-4 w-4 mr-1" />Prev</Button>
              <Button variant="outline" size="sm" disabled={session.current === session.questions.length - 1} onClick={() => setSession(s => ({ ...s, current: s.current + 1 }))}>Next<ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
            <Button onClick={evaluate} disabled={loading || evalRes} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}Evaluate</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProgressSummary() {
  const [d, setD] = useState(null)
  useEffect(() => { fetch('/api/interview/progress').then(r => r.json()).then(setD) }, [])
  if (!d || d.totalAnswers === 0) return null
  return (
    <Card className="glass border-0">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-500" />Progress dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-4 gap-2">{Object.entries(d.dimensions || {}).map(([k, v]) => <div key={k} className="text-center p-2 rounded bg-muted"><div className="text-xl font-bold">{v}</div><div className="text-[10px] text-muted-foreground capitalize">{k}</div></div>)}</div>
        <div><div className="text-xs text-muted-foreground mb-1">By category</div><div className="space-y-1">{Object.entries(d.byCategory || {}).map(([c, x]) => <div key={c} className="flex items-center justify-between text-xs"><span className="capitalize">{c}</span><Badge variant="secondary">{x.count} · avg {x.avg}</Badge></div>)}</div></div>
      </CardContent>
    </Card>
  )
}

function LearningPlanCard() {
  const [resumes, setResumes] = useState([])
  const [form, setForm] = useState({ resumeId: '', targetRole: '', company: '' })
  const [plans, setPlans] = useState([])
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    fetch('/api/resumes').then(r => r.json()).then(d => setResumes(d.resumes || []))
    fetch('/api/interview/learning-plans').then(r => r.json()).then(d => setPlans(d.plans || []))
  }, [])
  async function gen() {
    if (!form.targetRole) return toast.error('Target role required')
    setBusy(true)
    try {
      const r = await fetch('/api/interview/learning-plan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setSelected(d.plan)
      const list = await fetch('/api/interview/learning-plans').then(r => r.json()); setPlans(list.plans || [])
      toast.success('Learning plan ready!')
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <Card className="glass border-0">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />4-week learning plan</CardTitle><CardDescription>Personalized study track for your target role.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <Select value={form.resumeId} onValueChange={v => setForm({...form, resumeId: v})}><SelectTrigger><SelectValue placeholder="Resume (optional)" /></SelectTrigger><SelectContent>{resumes.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>
          <input className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.targetRole} onChange={e => setForm({...form, targetRole: e.target.value})} placeholder="Target role e.g. Backend SWE" />
          <input className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company (optional)" />
        </div>
        <Button size="sm" onClick={gen} disabled={busy} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Generating…</> : <><Sparkles className="h-4 w-4 mr-1" />Generate plan</>}</Button>
        {plans.slice(0, 3).map(p => (
          <div key={p.id} onClick={() => setSelected(p.plan || p)} className="p-3 rounded-lg border cursor-pointer hover:border-primary/40">
            <div className="font-medium text-sm">{p.plan?.title || 'Plan'}</div>
            <div className="text-xs text-muted-foreground">{p.targetRole} {p.company ? '@ ' + p.company : ''} · {new Date(p.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
        {selected && (
          <div className="glass rounded-lg p-3 max-h-96 overflow-auto text-sm space-y-3">
            <div className="font-semibold">{selected.title}</div>
            <p className="text-muted-foreground text-xs">{selected.overview}</p>
            {(selected.weeks || []).map((w, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="font-medium">Week {w.week}: {w.theme}</div>
                <ul className="text-xs mt-1 space-y-1">{(w.days || []).map((d, j) => <li key={j}><b>Day {d.day}</b> — {d.focus}<div className="text-muted-foreground pl-3">{(d.tasks || []).map(t => `• ${t.task} (${t.minutes}m)`).join(' · ')}</div></li>)}</ul>
              </div>
            ))}
            {selected.milestones && <div><div className="font-medium">Milestones</div><ul className="text-xs">{selected.milestones.map((m, i) => <li key={i}>✓ {m}</li>)}</ul></div>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EvalView({ e }) {  return (
    <div className="space-y-3 glass rounded-xl p-4">
      <div className="flex items-center justify-between"><div className="font-semibold">AI Evaluation</div><div className="text-3xl font-bold gradient-text">{e.overallScore}<span className="text-sm text-muted-foreground">/100</span></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[['Communication', e.communicationScore], ['Confidence', e.confidenceScore], ['Technical', e.technicalScore], ['Grammar', e.grammarScore]].map(([l, v]) => (
          <div key={l} className="text-center p-2 rounded-lg bg-muted/50"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div><div className="font-medium text-emerald-600 mb-1">Strengths</div><ul className="space-y-1">{e.strengths?.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
        <div><div className="font-medium text-orange-600 mb-1">Improvements</div><ul className="space-y-1">{e.improvements?.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
      </div>
      {e.betterAnswer && <div><div className="font-medium mb-1">Model answer</div><p className="text-sm text-muted-foreground">{e.betterAnswer}</p></div>}
      <div className="text-sm border-t pt-2"><span className="font-medium">Verdict:</span> {e.verdict}</div>
    </div>
  )
}

function CodingSession({ session, setSession, evaluate, loading, onExit }) {
  const p = session.problem
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Coding Interview — {p.title}</h1><Button variant="outline" onClick={onExit}>End session</Button></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0">
          <CardHeader><CardTitle className="text-lg">{p.title}</CardTitle><div className="flex gap-2"><Badge>{p.difficulty}</Badge><Badge variant="outline">{p.topic}</Badge></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="whitespace-pre-wrap">{p.statement}</div>
            {p.examples?.length > 0 && <div><div className="font-medium mb-2">Examples</div>{p.examples.map((ex, i) => <div key={i} className="font-mono text-xs bg-muted rounded-lg p-3 mb-2"><div><b>Input:</b> {ex.input}</div><div><b>Output:</b> {ex.output}</div>{ex.explanation && <div className="text-muted-foreground mt-1">{ex.explanation}</div>}</div>)}</div>}
            {p.constraints?.length > 0 && <div><div className="font-medium mb-1">Constraints</div><ul className="space-y-1 text-muted-foreground">{p.constraints.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}
          </CardContent>
        </Card>
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">Your solution</CardTitle><Button size="sm" onClick={evaluate} disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Evaluate'}</Button></CardHeader>
          <CardContent><Textarea rows={16} value={session.code} onChange={e => setSession(s => ({ ...s, code: e.target.value }))} placeholder="Write your solution here…" className="font-mono text-xs" /></CardContent>
        </Card>
      </div>
      {session.feedback && (
        <Card className="glass-strong border-0">
          <CardHeader><CardTitle className="flex items-center justify-between">AI Feedback<span className="text-3xl font-bold gradient-text">{session.feedback.overallScore}/100</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[['Correctness', session.feedback.correctness], ['Efficiency', session.feedback.efficiency], ['Style', session.feedback.style]].map(([l, v]) => <div key={l} className="text-center p-2 rounded-lg bg-muted/50"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
            </div>
            {session.feedback.bugs?.length > 0 && <div><div className="font-medium text-red-600 mb-1">Bugs</div><ul>{session.feedback.bugs.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
            {session.feedback.improvements?.length > 0 && <div><div className="font-medium text-orange-600 mb-1">Improvements</div><ul>{session.feedback.improvements.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
            {session.feedback.betterApproach && <div><div className="font-medium mb-1">Better approach</div><p className="text-sm text-muted-foreground">{session.feedback.betterApproach}</p></div>}
            <div className="text-sm border-t pt-2"><b>Verdict:</b> {session.feedback.verdict}</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SystemDesignSession({ session, setSession, evaluate, loading, onExit }) {
  const p = session.problem
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">System Design — {p?.title}</h1><Button variant="outline" onClick={onExit}>End session</Button></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0">
          <CardHeader><CardTitle className="text-lg">{p?.title}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="whitespace-pre-wrap">{p?.statement}</div>
            {p?.requirements && <div><div className="font-medium mb-1">Requirements</div><div className="text-muted-foreground whitespace-pre-wrap">{typeof p.requirements === 'string' ? p.requirements : JSON.stringify(p.requirements, null, 2)}</div></div>}
            {p?.constraints?.length > 0 && <div><div className="font-medium mb-1">Constraints</div><ul className="space-y-1 text-muted-foreground">{p.constraints.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}
            {p?.hints?.length > 0 && <div><div className="font-medium mb-1">Hints</div><ul className="space-y-1 text-muted-foreground">{p.hints.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}
          </CardContent>
        </Card>
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">Your design</CardTitle><Button size="sm" onClick={evaluate} disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Evaluate'}</Button></CardHeader>
          <CardContent><Textarea rows={16} value={session.answer} onChange={e => setSession(s => ({ ...s, answer: e.target.value }))} placeholder="Describe your architecture, components, data model, tradeoffs…" /></CardContent>
        </Card>
      </div>
      {session.feedback && (
        <Card className="glass-strong border-0">
          <CardHeader><CardTitle className="flex items-center justify-between">AI Feedback<span className="text-3xl font-bold gradient-text">{session.feedback.overallScore}/100</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {session.feedback.strengths?.length > 0 && <div><div className="font-medium text-emerald-600 mb-1">Strengths</div><ul>{session.feedback.strengths.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
            {session.feedback.gaps?.length > 0 && <div><div className="font-medium text-orange-600 mb-1">Gaps</div><ul>{session.feedback.gaps.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
            {session.feedback.improvements?.length > 0 && <div><div className="font-medium mb-1">Improvements</div><ul>{session.feedback.improvements.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
            <div className="text-sm border-t pt-2"><b>Verdict:</b> {session.feedback.verdict}</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
