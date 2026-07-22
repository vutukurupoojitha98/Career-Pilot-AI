'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, FileText, Search, Target, MessageSquare, BarChart3, Users, ShieldCheck, Zap, CheckCircle2, Brain, Rocket } from 'lucide-react'

const features = [
  { icon: FileText, title: 'AI Resume Analyzer', desc: 'Instant ATS scoring, keyword gaps, weak-bullet detection, and salary estimates.' },
  { icon: Sparkles, title: 'Smart Resume Builder', desc: 'Optimize resumes for any role — grounded strictly in your true experience.' },
  { icon: Search, title: 'Location-Aware Job Search', desc: 'Country, state, city, remote/hybrid filters that actually respect what you pick.' },
  { icon: Target, title: 'AI Job Matching', desc: 'Match scores, skill-gap analysis, and specific improvements for every job.' },
  { icon: MessageSquare, title: 'Interview Coach', desc: 'Mock interviews with HR, technical, coding, system design, and behavioral tracks.' },
  { icon: Users, title: 'Recruiter CRM', desc: 'Track recruiter contacts, personalized outreach, and follow-up scheduling.' },
  { icon: BarChart3, title: 'Application Tracker', desc: 'Kanban, timeline, and calendar views with response-rate analytics.' },
  { icon: ShieldCheck, title: 'Multi-Provider AI', desc: 'GPT-5, Claude Sonnet 4.5, and Gemini 2.5 Pro — switch anytime in settings.' },
]

const steps = [
  { n: '01', title: 'Upload your resume', desc: 'PDF or DOCX. We parse it into structured data instantly.' },
  { n: '02', title: 'Get your ATS score', desc: 'AI analysis of grammar, keywords, formatting, and recruiter-friendliness.' },
  { n: '03', title: 'Optimize + apply', desc: 'Tailored resumes, cover letters, and interview prep for every job.' },
]

export default function LandingPage() {
  const [me, setMe] = useState(null)
  useEffect(() => { fetch('/api/auth/me').then(r => r.json()).then(d => setMe(d.user)).catch(() => {}) }, [])
  return (
    <div className="min-h-screen gradient-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/40 dark:border-white/10 backdrop-blur-xl bg-background/60">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center shadow-lg shadow-indigo-500/30">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">CareerPilot <span className="gradient-text">AI</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            {me ? (
              <Button asChild size="sm"><Link href="/dashboard">Open dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
                <Button asChild size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20">
                  <Link href="/signup">Get started free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-20 pb-16 text-center relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge className="mb-6 rounded-full px-4 py-1.5 bg-primary/10 text-primary border-primary/20" variant="outline">
            <Sparkles className="h-3 w-3 mr-1.5" /> Powered by GPT-5, Claude Sonnet 4.5 & Gemini 2.5 Pro
          </Badge>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
            Land your dream job<br /><span className="gradient-text">10x faster</span> with AI.
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
            CareerPilot AI is your always-on career copilot. Optimize resumes, discover jobs, tailor applications, ace interviews, and manage your entire pipeline — all in one beautiful workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-base h-12 px-8 shadow-xl shadow-indigo-500/30">
              <Link href={me ? '/dashboard' : '/signup'}>Start free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 glass"><Link href="#features">See features</Link></Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="mt-20 relative">
          <div className="glass-strong rounded-3xl p-6 md:p-10 max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Brain, label: 'ATS Score', value: '92/100', hint: 'up 34 pts' },
                { icon: Target, label: 'Job Match', value: '88%', hint: 'for Senior Eng' },
                { icon: Zap, label: 'Applied', value: '47 jobs', hint: 'this week' },
              ].map((s, i) => (
                <div key={i} className="glass rounded-2xl p-6 text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><s.icon className="h-5 w-5 text-white" /></div>
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="text-3xl font-bold">{s.value}</div>
                  <div className="text-sm text-emerald-500 mt-1">↑ {s.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4">Everything you need</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Your complete career operating system</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">From the first draft of your resume to the offer letter — every step, powered by AI.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-6 hover-lift">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 grid place-items-center mb-4">
                <f.icon className="h-5 w-5 text-indigo-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4">3 simple steps</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">From resume to offer, on autopilot</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="glass rounded-2xl p-8 relative overflow-hidden">
              <div className="text-6xl font-black gradient-text opacity-30 absolute -top-2 right-4">{s.n}</div>
              <h3 className="text-xl font-bold mb-2 relative">{s.title}</h3>
              <p className="text-muted-foreground relative">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24">
        <div className="glass-strong rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Your career, upgraded.</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">Join thousands of professionals using CareerPilot AI to land better jobs, faster.</p>
            <Button asChild size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white h-12 px-8 shadow-xl shadow-indigo-500/30">
              <Link href={me ? '/dashboard' : '/signup'}>Get started — it's free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cancel anytime</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> GPT-5 included</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-10 border-t border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <span>© 2025 CareerPilot AI — Built with GPT-5, Claude & Gemini.</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
