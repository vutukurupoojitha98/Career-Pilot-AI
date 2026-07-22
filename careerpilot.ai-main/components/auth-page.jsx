'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Rocket, Loader2 } from 'lucide-react'

export default function AuthPage({ mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const isSignup = mode === 'signup'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Handle Emergent Google OAuth callback (session_id in hash)
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.includes('session_id=')) {
      const sessionId = new URLSearchParams(hash.slice(1)).get('session_id')
      if (sessionId) {
        setGoogleLoading(true)
        fetch('/api/auth/emergent/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) })
          .then(r => r.json())
          .then(d => {
            if (d.user) {
              toast.success('Signed in as ' + d.user.name)
              window.location.href = '/dashboard'
            } else {
              toast.error(d.error || 'Google sign-in failed')
              setGoogleLoading(false)
            }
          })
          .catch(e => { toast.error('Sign-in failed'); setGoogleLoading(false) })
      }
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${isSignup ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Auth failed')
      toast.success(isSignup ? 'Welcome to CareerPilot AI!' : 'Welcome back!')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  function googleSignIn() {
    const redirect = encodeURIComponent(window.location.origin + '/login')
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirect}`
  }

  return (
    <div className="min-h-screen gradient-bg grid place-items-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center shadow-lg shadow-indigo-500/30">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">CareerPilot <span className="gradient-text">AI</span></span>
        </Link>
        <Card className="glass-strong border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{isSignup ? 'Create your account' : 'Welcome back'}</CardTitle>
            <CardDescription>{isSignup ? 'Start optimizing your career with AI' : 'Sign in to continue your journey'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={googleSignIn} disabled={googleLoading} variant="outline" className="w-full h-11 glass">
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )} Continue with Google
            </Button>
            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
              )}
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" /></div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSignup ? 'Create account' : 'Sign in')}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <Link href={isSignup ? '/login' : '/signup'} className="font-medium text-primary hover:underline">{isSignup ? 'Sign in' : 'Sign up'}</Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
