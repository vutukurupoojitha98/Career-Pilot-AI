'use client'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Sparkles, Square, Circle as CircleIcon, Trash2, Loader2, Layers, Link2 } from 'lucide-react'

// Lightweight SVG whiteboard — no external dependencies. Drag to move, click "Connect" to link two shapes.
export default function WhiteboardPage() {
  const [shapes, setShapes] = useState([
    { id: 's1', type: 'rect', x: 60, y: 60, w: 160, h: 60, label: 'Load Balancer', color: '#6366f1' },
    { id: 's2', type: 'rect', x: 60, y: 180, w: 160, h: 60, label: 'API Gateway', color: '#8b5cf6' },
    { id: 's3', type: 'rect', x: 340, y: 120, w: 160, h: 60, label: 'App Servers', color: '#ec4899' },
    { id: 's4', type: 'circle', x: 620, y: 90, r: 42, label: 'Cache', color: '#f59e0b' },
    { id: 's5', type: 'circle', x: 620, y: 240, r: 42, label: 'DB', color: '#10b981' },
  ])
  const [connections, setConnections] = useState([
    { from: 's1', to: 's2' }, { from: 's2', to: 's3' }, { from: 's3', to: 's4' }, { from: 's3', to: 's5' },
  ])
  const [problem, setProblem] = useState(null)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState({ problem: false, evaluate: false })
  const [connectFrom, setConnectFrom] = useState(null)
  const svgRef = useRef(null)
  const dragRef = useRef(null)

  function center(s) { return s.type === 'circle' ? { x: s.x, y: s.y } : { x: s.x + s.w / 2, y: s.y + s.h / 2 } }

  function onMouseDown(e, id) {
    if (connectFrom) {
      if (connectFrom !== id) { setConnections(c => [...c, { from: connectFrom, to: id }]); toast.success('Connected') }
      setConnectFrom(null); return
    }
    const svg = svgRef.current.getBoundingClientRect()
    const shape = shapes.find(s => s.id === id)
    const startX = e.clientX - svg.left - (shape.type === 'circle' ? shape.x : shape.x)
    const startY = e.clientY - svg.top - (shape.type === 'circle' ? shape.y : shape.y)
    dragRef.current = { id, offsetX: startX, offsetY: startY }
  }
  function onMouseMove(e) {
    if (!dragRef.current) return
    const svg = svgRef.current.getBoundingClientRect()
    const { id, offsetX, offsetY } = dragRef.current
    setShapes(prev => prev.map(s => s.id === id ? { ...s, x: e.clientX - svg.left - offsetX, y: e.clientY - svg.top - offsetY } : s))
  }
  function onMouseUp() { dragRef.current = null }

  useEffect(() => {
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  function addRect() { setShapes(s => [...s, { id: 'r' + Date.now(), type: 'rect', x: 100 + Math.random() * 400, y: 100 + Math.random() * 200, w: 140, h: 60, label: `Component ${s.length + 1}`, color: '#6366f1' }]) }
  function addCircle() { setShapes(s => [...s, { id: 'c' + Date.now(), type: 'circle', x: 200 + Math.random() * 400, y: 200 + Math.random() * 100, r: 42, label: 'Store', color: '#8b5cf6' }]) }
  function clearAll() { setShapes([]); setConnections([]); setConnectFrom(null) }
  function editLabel(id) {
    const s = shapes.find(x => x.id === id)
    const label = prompt('Label', s.label)
    if (label !== null) setShapes(prev => prev.map(x => x.id === id ? { ...x, label } : x))
  }

  async function fetchProblem() {
    setBusy(b => ({ ...b, problem: true }))
    try {
      const r = await fetch('/api/interview/system-design', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ difficulty: 'senior' }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setProblem(d.problem); setFeedback(null); toast.success('Problem loaded')
    } catch (e) { toast.error(e.message) } finally { setBusy(b => ({ ...b, problem: false })) }
  }
  async function evaluate() {
    if (!answer.trim()) return toast.error('Describe your design in notes')
    setBusy(b => ({ ...b, evaluate: true }))
    try {
      const arch = `Components: ${shapes.map(s => s.label).join(', ')}\nConnections: ${connections.map(c => `${shapes.find(s => s.id === c.from)?.label} -> ${shapes.find(s => s.id === c.to)?.label}`).join('; ')}`
      const r = await fetch('/api/interview/system-design', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: problem?.title || 'System design', answer: answer + '\n\n[Whiteboard]\n' + arch }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setFeedback(d.evaluation)
    } catch (e) { toast.error(e.message) } finally { setBusy(b => ({ ...b, evaluate: false })) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Layers className="h-7 w-7 text-primary" />System Design Whiteboard</h1><p className="text-muted-foreground">Sketch architectures + get AI feedback on your design. {connectFrom && <span className="text-primary font-medium">Click a shape to connect →</span>}</p></div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={addRect}><Square className="h-4 w-4 mr-1" />Service</Button>
          <Button variant="outline" size="sm" onClick={addCircle}><CircleIcon className="h-4 w-4 mr-1" />Store</Button>
          <Button variant={connectFrom ? 'default' : 'outline'} size="sm" onClick={() => setConnectFrom(shapes[0]?.id)}><Link2 className="h-4 w-4 mr-1" />Connect mode</Button>
          <Button variant="outline" size="sm" onClick={clearAll}><Trash2 className="h-4 w-4 mr-1" />Clear</Button>
          <Button size="sm" onClick={fetchProblem} disabled={busy.problem} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy.problem ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}New problem</Button>
        </div>
      </div>

      {problem && <Card className="glass border-0"><CardHeader><CardTitle className="text-base">{problem.title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{problem.statement}</CardContent></Card>}

      <Card className="glass border-0">
        <CardContent className="p-2">
          <div className="w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-900" style={{ height: 500 }}>
            <svg ref={svgRef} width="100%" height="500" onMouseMove={onMouseMove} style={{ cursor: dragRef.current ? 'grabbing' : 'default' }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" /></marker>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {connections.map((c, i) => {
                const from = shapes.find(s => s.id === c.from), to = shapes.find(s => s.id === c.to)
                if (!from || !to) return null
                const a = center(from), b = center(to)
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
              })}
              {shapes.map(s => (
                <g key={s.id} onMouseDown={e => onMouseDown(e, s.id)} onDoubleClick={() => editLabel(s.id)} style={{ cursor: 'grab', userSelect: 'none' }}>
                  {s.type === 'rect' ? <>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="10" fill={s.color} opacity="0.95" />
                    <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{s.label}</text>
                  </> : <>
                    <circle cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity="0.95" />
                    <text x={s.x} y={s.y + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{s.label}</text>
                  </>}
                </g>
              ))}
            </svg>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Double-click a shape to rename. Drag to reposition.</div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Design notes</CardTitle><Button size="sm" onClick={evaluate} disabled={busy.evaluate} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy.evaluate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}AI evaluate</Button></CardHeader>
          <CardContent><Textarea rows={10} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Describe: (1) requirements & scale, (2) components & data flow, (3) storage choices, (4) tradeoffs, (5) failure modes." /></CardContent>
        </Card>
        {feedback && (
          <Card className="glass-strong border-0">
            <CardHeader><CardTitle className="flex items-center justify-between">Feedback<span className="text-3xl font-bold gradient-text">{feedback.overallScore}/100</span></CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {feedback.strengths?.length > 0 && <div><div className="font-medium text-emerald-500">Strengths</div><ul>{feedback.strengths.map((b,i) => <li key={i}>• {b}</li>)}</ul></div>}
              {feedback.gaps?.length > 0 && <div><div className="font-medium text-orange-500">Gaps</div><ul>{feedback.gaps.map((b,i) => <li key={i}>• {b}</li>)}</ul></div>}
              <div className="text-xs italic border-t pt-2">{feedback.verdict}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
