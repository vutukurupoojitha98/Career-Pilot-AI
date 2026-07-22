'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Play, Sparkles, Code2, Wand2, BookOpen } from 'lucide-react'

const Editor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <div className="h-full grid place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div> })

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'csharp', 'ruby', 'sql']
const SAMPLES = {
  javascript: `// Two Sum
function twoSum(nums, target) {
  const map = new Map()
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i]
    if (map.has(need)) return [map.get(need), i]
    map.set(nums[i], i)
  }
  return []
}
console.log(twoSum([2,7,11,15], 9))`,
  python: `# Two Sum
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen: return [seen[target - n], i]
        seen[n] = i
    return []
print(two_sum([2,7,11,15], 9))`,
}

export default function PlaygroundPage() {
  const [lang, setLang] = useState('javascript')
  const [code, setCode] = useState(SAMPLES.javascript)
  const [output, setOutput] = useState('')
  const [problem, setProblem] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState({ problem: false, evaluate: false })
  const { theme } = useThemeSafe()

  useEffect(() => { setCode(SAMPLES[lang] || `// ${lang} playground\n`) }, [lang])

  function runLocally() {
    setOutput('Running...')
    if (lang !== 'javascript') { setOutput('Local execution only supported for JavaScript. Use "AI evaluate" for other languages.'); return }
    try {
      const logs = []
      const c = new Function('console', code)
      c({ log: (...a) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')), error: (...a) => logs.push('[error] ' + a.join(' ')) })
      setOutput(logs.join('\n') || '(no output)')
    } catch (e) {
      setOutput('Error: ' + e.message)
    }
  }

  async function fetchProblem(difficulty = 'medium') {
    setBusy(b => ({ ...b, problem: true }))
    try {
      const r = await fetch('/api/interview/coding', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ difficulty, language: lang }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setProblem(d.problem); setFeedback(null); toast.success('Problem loaded')
    } catch (e) { toast.error(e.message) } finally { setBusy(b => ({ ...b, problem: false })) }
  }

  async function evaluate() {
    setBusy(b => ({ ...b, evaluate: true })); setFeedback(null)
    try {
      const r = await fetch('/api/interview/coding/evaluate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ problem: problem || { title: 'Custom code review', statement: 'Review the following code.' }, code, language: lang }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setFeedback(d.evaluation)
    } catch (e) { toast.error(e.message) } finally { setBusy(b => ({ ...b, evaluate: false })) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Code2 className="h-7 w-7 text-primary" />Coding Playground</h1><p className="text-muted-foreground">Monaco editor · run JS locally · AI evaluate any language.</p></div>
        <div className="flex gap-2">
          <Select value={lang} onValueChange={setLang}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" onClick={() => fetchProblem('easy')} disabled={busy.problem}>{busy.problem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}New problem</Button>
        </div>
      </div>
      {problem && (
        <Card className="glass border-0">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />{problem.title}<Badge>{problem.difficulty}</Badge></CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="whitespace-pre-wrap">{problem.statement}</div>
            {problem.examples?.length > 0 && <div className="grid gap-2">{problem.examples.map((ex, i) => <div key={i} className="font-mono text-xs bg-muted rounded p-2"><div><b>Input:</b> {ex.input}</div><div><b>Output:</b> {ex.output}</div></div>)}</div>}
          </CardContent>
        </Card>
      )}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Editor</CardTitle><div className="flex gap-2"><Button size="sm" onClick={runLocally}><Play className="h-3 w-3 mr-1" />Run</Button><Button size="sm" onClick={evaluate} disabled={busy.evaluate} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">{busy.evaluate ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}AI evaluate</Button></div></CardHeader>
          <CardContent><div className="h-[500px] rounded-lg overflow-hidden border"><Editor height="500px" language={lang} value={code} onChange={v => setCode(v || '')} theme={theme === 'dark' ? 'vs-dark' : 'light'} options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on' }} /></div></CardContent>
        </Card>
        <div className="space-y-3">
          <Card className="glass border-0"><CardHeader><CardTitle className="text-base">Output</CardTitle></CardHeader><CardContent><pre className="text-xs font-mono bg-muted rounded p-3 min-h-24 max-h-56 overflow-auto whitespace-pre-wrap">{output || '(run to see output)'}</pre></CardContent></Card>
          {feedback && (
            <Card className="glass border-0">
              <CardHeader><CardTitle className="text-base flex items-center justify-between">AI Feedback<span className="text-2xl font-bold gradient-text">{feedback.overallScore}/100</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">{[['Correctness',feedback.correctness],['Efficiency',feedback.efficiency],['Style',feedback.style]].map(([l,v]) => <div key={l} className="text-center bg-muted rounded p-2"><div className="text-lg font-bold">{v}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>)}</div>
                {feedback.bugs?.length > 0 && <div><div className="font-medium text-red-500">Bugs</div><ul className="text-xs">{feedback.bugs.map((b,i) => <li key={i}>• {b}</li>)}</ul></div>}
                {feedback.improvements?.length > 0 && <div><div className="font-medium text-orange-500">Improvements</div><ul className="text-xs">{feedback.improvements.map((b,i) => <li key={i}>• {b}</li>)}</ul></div>}
                <div className="text-xs italic border-t pt-2">{feedback.verdict}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function useThemeSafe() {
  const [t, setT] = useState('light')
  useEffect(() => {
    if (typeof document !== 'undefined') setT(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])
  return { theme: t }
}
