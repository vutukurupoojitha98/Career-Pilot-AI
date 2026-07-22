import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, clean, cleanArray } from '@/lib/mongodb'
import { createUser, findUserByEmail, verifyPassword, setAuthCookie, clearAuthCookie, getCurrentUser, findUserById } from '@/lib/auth'
import { chatCompletion, chatJSON, MODELS, resolveModel } from '@/lib/llm'
import { extractText } from '@/lib/parser'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const j = (data, status = 200) => cors(NextResponse.json(data, { status }))
export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

async function requireUser(request) {
  const user = await getCurrentUser(request)
  if (!user) return { error: j({ error: 'Unauthorized' }, 401) }
  return { user }
}
async function requireAdmin(request) {
  const { user, error } = await requireUser(request)
  if (error) return { error }
  if (user.role !== 'admin') return { error: j({ error: 'Forbidden' }, 403) }
  return { user }
}

async function handle(request, { params }) {
  const { path = [] } = await params
  const route = '/' + path.join('/')
  const method = request.method

  // Fast-path health endpoints (no DB required — critical for Kubernetes readiness probe)
  if (method === 'GET' && (route === '/' || route === '/root' || route === '/health')) {
    return j({ ok: true, status: 'ok', app: 'CareerPilot AI', ts: Date.now() })
  }

  try {
    const db = await getDb()

    // ============ NON-DB DEPENDENT ============
    if (route === '/models' && method === 'GET') return j({ models: MODELS })

    // ============ AUTH ============
    if (route === '/auth/signup' && method === 'POST') {
      const { email, password, name } = await request.json()
      if (!email || !password || password.length < 6) return j({ error: 'Email and password (min 6 chars) required' }, 400)
      try {
        const user = await createUser({ email, password, name })
        await setAuthCookie(user.id)
        return j({ user: pubUser(user) })
      } catch (e) { return j({ error: e.message }, 400) }
    }
    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await request.json()
      const u = await findUserByEmail(email || '')
      if (!u || !u.passwordHash) return j({ error: 'Invalid email or password' }, 401)
      const ok = await verifyPassword(password || '', u.passwordHash)
      if (!ok) return j({ error: 'Invalid email or password' }, 401)
      await setAuthCookie(u.id)
      return j({ user: pubUser(u) })
    }
    if (route === '/auth/logout' && method === 'POST') {
      await clearAuthCookie(); return j({ ok: true })
    }
    if (route === '/auth/me' && method === 'GET') {
      const u = await getCurrentUser(request)
      return j({ user: u ? pubUser(u) : null })
    }
    if (route === '/auth/emergent/session' && method === 'POST') {
      const { session_id } = await request.json()
      if (!session_id) return j({ error: 'Missing session_id' }, 400)
      const r = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', { headers: { 'X-Session-ID': session_id } })
      if (!r.ok) return j({ error: 'Failed to verify session' }, 401)
      const profile = await r.json()
      let user = await findUserByEmail(profile.email)
      if (!user) user = await createUser({ email: profile.email, name: profile.name, provider: 'google', picture: profile.picture, password: null })
      await setAuthCookie(user.id)
      return j({ user: pubUser(user) })
    }

    // ============ SETTINGS ============
    if (route === '/settings' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      return j({ settings: user.settings, profile: { name: user.name, email: user.email, picture: user.picture } })
    }
    if (route === '/settings' && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const upd = { updatedAt: new Date() }
      if (body.settings) upd.settings = { ...user.settings, ...body.settings }
      if (body.name) upd.name = body.name
      await db.collection('users').updateOne({ id: user.id }, { $set: upd })
      const fresh = await findUserById(user.id)
      return j({ ok: true, user: pubUser(fresh) })
    }

    // ============ RESUMES ============
    if (route === '/resumes' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('resumes').find({ userId: user.id }).sort({ createdAt: -1 }).limit(200).toArray()
      return j({ resumes: cleanArray(list) })
    }
    if (route === '/resumes/upload' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') return j({ error: 'No file uploaded' }, 400)
      const buffer = Buffer.from(await file.arrayBuffer())
      const mimeType = file.type || 'application/octet-stream'
      const filename = file.name || 'resume'
      const rawText = await extractText(buffer, mimeType, filename)
      if (!rawText || rawText.length < 40) return j({ error: 'Could not extract text from file.' }, 400)
      const provider = user.settings?.aiProvider || 'openai'
      const { data: parsed } = await chatJSON({ provider, system: 'You are an expert resume parser.', user: `Parse this resume into JSON with keys: name, email, phone, linkedin, github, portfolio, location, summary, skills (string[]), experience (array with: title, company, location, startDate, endDate, current (bool), bullets (string[])), education (array with: degree, school, location, startDate, endDate, details), projects (array with: name, description, tech (string[]), link), certifications (array with: name, issuer, date). Use empty string/array for missing. Do not invent info.\n\nRESUME:\n${rawText.slice(0, 15000)}`, maxTokens: 4000 })
      const id = uuidv4(); const now = new Date()
      const doc = { id, userId: user.id, title: parsed?.name ? `${parsed.name}'s Resume` : filename, originalFilename: filename, mimeType, rawText, parsed, source: 'upload', atsScore: null, createdAt: now, updatedAt: now }
      await db.collection('resumes').insertOne(doc)
      await db.collection('resume_versions').insertOne({ id: uuidv4(), resumeId: id, userId: user.id, label: 'Original upload', parsed, rawText, atsScore: null, createdAt: now })
      return j({ resume: clean(doc) })
    }
    if (path[0] === 'resumes' && path.length === 2 && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const r = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
      if (!r) return j({ error: 'Not found' }, 404)
      return j({ resume: clean(r) })
    }
    if (path[0] === 'resumes' && path.length === 2 && method === 'DELETE') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('resumes').deleteOne({ id: path[1], userId: user.id })
      await db.collection('resume_versions').deleteMany({ resumeId: path[1] })
      return j({ ok: true })
    }
    if (path[0] === 'resumes' && path.length === 2 && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const upd = { updatedAt: new Date() }
      if (body.title) upd.title = body.title
      if (body.parsed) upd.parsed = body.parsed
      await db.collection('resumes').updateOne({ id: path[1], userId: user.id }, { $set: upd })
      const fresh = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
      return j({ resume: clean(fresh) })
    }
    if (path[0] === 'resumes' && path[2] === 'analyze' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const r = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
      if (!r) return j({ error: 'Not found' }, 404)
      const body = await request.json().catch(() => ({}))
      const { data: analysis } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are a senior recruiter and ATS expert. Never invent facts.',
        user: `Analyze this resume. Return JSON: atsScore (0-100 int), grammarScore, formattingScore, keywordScore, recruiterFriendliness, readingTimeSec (int), strengths (string[]), weaknesses (string[]), weakBullets ({original, improved}[]), missingKeywords (string[]), missingSkills (string[]), suggestions (string[]), salaryEstimate {currency, minAnnual, maxAnnual, note}, overallSummary (string).\nTarget role: ${body.targetRole || 'General'}\n${body.jobDescription ? 'JD:\n' + body.jobDescription.slice(0, 3000) : ''}\n\nResume JSON:\n${JSON.stringify(r.parsed).slice(0, 8000)}\n\nRaw text:\n${(r.rawText || '').slice(0, 5000)}`,
        maxTokens: 3500 })
      await db.collection('resumes').updateOne({ id: r.id }, { $set: { atsScore: analysis.atsScore, lastAnalysis: analysis, updatedAt: new Date() } })
      await db.collection('resume_analyses').insertOne({ id: uuidv4(), resumeId: r.id, userId: user.id, targetRole: body.targetRole, analysis, createdAt: new Date() })
      return j({ analysis })
    }
    if (path[0] === 'resumes' && path[2] === 'optimize' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const r = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
      if (!r) return j({ error: 'Not found' }, 404)
      const body = await request.json().catch(() => ({}))
      const { data: optimized } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are a world-class resume writer. Only use facts from input. Never invent employers, dates, titles, or metrics.',
        user: `Optimize this resume${body.targetRole ? ' for ' + body.targetRole : ''}. Return SAME schema (name, email, phone, linkedin, github, portfolio, location, summary, skills, experience, education, projects, certifications) with improved wording, action verbs, better summary, reorganized skills. Also include "changeLog" (string[]) and "optimizedFor" (string).\n${body.jobDescription ? 'Target JD:\n' + body.jobDescription.slice(0, 3000) + '\n' : ''}\nInput:\n${JSON.stringify(r.parsed).slice(0, 10000)}`,
        maxTokens: 5000 })
      const versionId = uuidv4()
      await db.collection('resume_versions').insertOne({ id: versionId, resumeId: r.id, userId: user.id, label: `Optimized${body.targetRole ? ' for ' + body.targetRole : ''}`, parsed: optimized, changeLog: optimized.changeLog || [], optimizedFor: body.targetRole, createdAt: new Date() })
      return j({ optimized, versionId })
    }
    if (path[0] === 'resumes' && path[2] === 'tailor' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const r = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
      if (!r) return j({ error: 'Not found' }, 404)
      const body = await request.json()
      const { data: tailored } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You tailor resumes strictly using facts already in the input. Never invent experience.',
        user: `Tailor this resume for this job. Highlight relevant experience, adjust summary, reorder skills. Return SAME schema plus changeLog (string[]) and matchNotes (string).\nJob title: ${body.jobTitle || ''}\nCompany: ${body.company || ''}\nJD:\n${(body.jobDescription || '').slice(0, 4000)}\n\nResume:\n${JSON.stringify(r.parsed).slice(0, 10000)}`,
        maxTokens: 5000 })
      const versionId = uuidv4()
      await db.collection('resume_versions').insertOne({ id: versionId, resumeId: r.id, userId: user.id, label: `Tailored: ${body.jobTitle || 'Custom'}`, parsed: tailored, changeLog: tailored.changeLog || [], createdAt: new Date() })
      return j({ tailored, versionId })
    }
    if (path[0] === 'resumes' && path[2] === 'versions' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const versions = await db.collection('resume_versions').find({ resumeId: path[1], userId: user.id }).sort({ createdAt: -1 }).limit(50).toArray()
      return j({ versions: cleanArray(versions) })
    }

    // ============ JOBS ============
    // GET /jobs/connectors — list available connectors
    if (route === '/jobs/connectors' && method === 'GET') {
      const { CONNECTORS } = await import('@/lib/connectors')
      return j({ connectors: Object.entries(CONNECTORS).map(([key, v]) => ({ key, name: v.name, live: v.live })) })
    }
    // POST /jobs/live-search — search via real connectors (RemoteOK, Greenhouse, Lever, Ashby) + AI fallbacks
    if (route === '/jobs/live-search' && method === 'POST') {
      const rl = (await import('@/lib/ratelimit')).limit('default', request.headers.get('x-forwarded-for') || 'anon')
      if (!rl.ok) return j({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` }, 429)
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { aggregate } = await import('@/lib/connectors')
      const providers = body.providers || ['remoteok', 'greenhouse', 'lever', 'ashby', 'wellfound', 'career_sites']
      const location = [body.city, body.state, body.country].filter(Boolean).join(', ')
      const q = [body.title, body.keywords].filter(Boolean).join(' ')
      const { jobs, bySource } = await aggregate({ query: q, location, providers, limit: body.limit || 40, llmProvider: user.settings?.aiProvider || 'openai' })
      // Optional filters
      let filtered = jobs
      if (body.workMode && body.workMode !== 'any') filtered = filtered.filter(j => j.workMode === body.workMode)
      if (body.experience && body.experience !== 'any') filtered = filtered.filter(j => j.experience === body.experience)
      if (body.salaryMin) filtered = filtered.filter(j => !j.salaryMin || j.salaryMin >= Number(body.salaryMin))
      if (body.visaSponsorship) filtered = filtered.filter(j => j.visaSponsorship)
      // Save search + write audit log
      const searchId = uuidv4()
      await db.collection('job_searches').insertOne({ id: searchId, userId: user.id, filters: body, jobs: filtered, bySource, live: true, createdAt: new Date() })
      await db.collection('audit_logs').insertOne({ id: uuidv4(), userId: user.id, action: 'jobs.live_search', meta: { count: filtered.length, providers, bySource }, at: new Date() })
      return j({ searchId, jobs: filtered, bySource })
    }
    // POST /jobs/search — AI-powered job search (location-filtered, all sources)
    if (route === '/jobs/search' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { title = '', keywords = '', country = '', state = '', city = '', workMode = 'any', experience = 'any', salaryMin = '', visaSponsorship = false, resumeId = null } = body
      let resumeCtx = ''
      if (resumeId) {
        const r = await db.collection('resumes').findOne({ id: resumeId, userId: user.id })
        if (r) resumeCtx = `Candidate resume context:\n${JSON.stringify(r.parsed).slice(0, 4000)}`
      }
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are a job-search engine that returns realistic, plausible job listings. Prioritize the specified location — do NOT include jobs in other locations. Use real, well-known companies where appropriate.',
        user: `Return JSON: { jobs: [{ id, title, company, companyLogo (initials), location, workMode (remote|hybrid|onsite), country, state, city, salaryMin, salaryMax, currency, experience (entry|mid|senior|staff), visaSponsorship (bool), skills (string[]), description (2-4 short paragraphs), postedDaysAgo (int), source (Greenhouse|Lever|Ashby|Wellfound|RemoteOK|Company Site), applyUrl (string), matchScore (0-100 int, if resume provided) }] }.\nReturn 12 jobs matching:\nTitle/keywords: ${title} ${keywords}\nLocation: ${city}${state ? ', ' + state : ''}${country ? ', ' + country : ''}\nWork mode: ${workMode}\nExperience: ${experience}\nMin salary: ${salaryMin}\nVisa sponsorship: ${visaSponsorship}\n${resumeCtx}`,
        maxTokens: 5500 })
      // Save to jobs collection for reference
      const jobs = (data.jobs || []).map(j => ({ ...j, id: j.id || uuidv4() }))
      const searchId = uuidv4()
      await db.collection('job_searches').insertOne({ id: searchId, userId: user.id, filters: body, jobs, createdAt: new Date() })
      return j({ searchId, jobs })
    }
    if (route === '/jobs/match' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { resumeId, job } = body
      const r = await db.collection('resumes').findOne({ id: resumeId, userId: user.id })
      if (!r) return j({ error: 'Resume not found' }, 404)
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You match resumes to jobs and give honest, actionable feedback.',
        user: `Score this match. Return JSON: matchScore (0-100), reason (string), strengths (string[]), skillGaps (string[]), improvements (string[]), keywordsToAdd (string[]).\nJob:\n${JSON.stringify(job).slice(0, 3000)}\nResume:\n${JSON.stringify(r.parsed).slice(0, 6000)}`,
        maxTokens: 2500 })
      return j({ match: data })
    }
    if (route === '/jobs/save' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, ...body.job, savedAt: new Date() }
      await db.collection('saved_jobs').insertOne(doc)
      return j({ saved: clean(doc) })
    }
    if (route === '/jobs/saved' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('saved_jobs').find({ userId: user.id }).sort({ savedAt: -1 }).limit(200).toArray()
      return j({ jobs: cleanArray(list) })
    }

    // ============ COVER LETTER ============
    if (route === '/cover-letter/generate' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { resumeId, jobTitle, company, jobDescription, style = 'professional', tone = 'confident' } = body
      const r = resumeId ? await db.collection('resumes').findOne({ id: resumeId, userId: user.id }) : null
      const { content } = await chatCompletion({ provider: user.settings?.aiProvider || 'openai',
        messages: [
          { role: 'system', content: `You write compelling cover letters. Style: ${style}. Tone: ${tone}. Use only facts from the resume. Never invent experience. Format with header, greeting, 3 body paragraphs, closing. Signed by ${r?.parsed?.name || user.name}. Do NOT include the date.` },
          { role: 'user', content: `Job: ${jobTitle} at ${company}\n\nJD:\n${(jobDescription || '').slice(0, 3500)}\n\nCandidate:\n${JSON.stringify(r?.parsed || {}).slice(0, 6000)}` },
        ],
        maxTokens: 1500,
      })
      const doc = { id: uuidv4(), userId: user.id, resumeId, jobTitle, company, style, tone, content, createdAt: new Date() }
      await db.collection('cover_letters').insertOne(doc)
      return j({ coverLetter: clean(doc) })
    }
    if (route === '/cover-letter/list' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('cover_letters').find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).toArray()
      return j({ coverLetters: cleanArray(list) })
    }

    // ============ APPLICATION TRACKER ============
    if (route === '/applications' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('applications').find({ userId: user.id }).sort({ updatedAt: -1 }).limit(500).toArray()
      return j({ applications: cleanArray(list) })
    }
    if (route === '/applications' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, jobTitle: body.jobTitle || '', company: body.company || '', location: body.location || '', salary: body.salary || '', link: body.link || '', notes: body.notes || '', status: body.status || 'applied', appliedDate: body.appliedDate || new Date(), events: [{ id: uuidv4(), type: 'status', status: body.status || 'applied', note: 'Application created', at: new Date() }], createdAt: new Date(), updatedAt: new Date() }
      await db.collection('applications').insertOne(doc)
      return j({ application: clean(doc) })
    }
    if (path[0] === 'applications' && path.length === 2 && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const app = await db.collection('applications').findOne({ id: path[1], userId: user.id })
      if (!app) return j({ error: 'Not found' }, 404)
      const upd = { updatedAt: new Date() }
      Object.assign(upd, body)
      const events = app.events || []
      if (body.status && body.status !== app.status) {
        events.push({ id: uuidv4(), type: 'status', status: body.status, note: `Status changed to ${body.status}`, at: new Date() })
        upd.events = events
      }
      await db.collection('applications').updateOne({ id: app.id }, { $set: upd })
      const fresh = await db.collection('applications').findOne({ id: app.id })
      return j({ application: clean(fresh) })
    }
    if (path[0] === 'applications' && path.length === 2 && method === 'DELETE') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('applications').deleteOne({ id: path[1], userId: user.id })
      return j({ ok: true })
    }

    // ============ INTERVIEW COACH ============
    // POST /interview/questions — generate questions for a role and category
    if (route === '/interview/questions' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { category = 'behavioral', jobTitle = '', jobDescription = '', count = 6, difficulty = 'medium' } = body
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are an expert interview coach.',
        user: `Return JSON: { questions: [{ id, question, category, difficulty, tips (string[]), sampleAnswer (string, brief), evaluationCriteria (string[]) }] }.\nGenerate ${count} ${difficulty} ${category} interview questions${jobTitle ? ' for the role: ' + jobTitle : ''}.\n${jobDescription ? 'JD:\n' + jobDescription.slice(0, 2500) : ''}\nCategories: hr, technical, behavioral, coding, system-design, managerial. Match category: ${category}.`,
        maxTokens: 3500 })
      const questions = (data.questions || []).map(q => ({ ...q, id: q.id || uuidv4() }))
      return j({ questions })
    }
    // POST /interview/evaluate — evaluate an answer to a question
    if (route === '/interview/evaluate' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { question, answer, category = 'behavioral', jobTitle = '' } = body
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are a fair but rigorous interview evaluator.',
        user: `Evaluate this ${category} interview answer${jobTitle ? ' for ' + jobTitle : ''}. Return JSON: { overallScore (0-100), communicationScore, confidenceScore, technicalScore, grammarScore, strengths (string[]), improvements (string[]), missingPoints (string[]), betterAnswer (string), verdict (string) }.\nQuestion: ${question}\nAnswer: ${answer}`,
        maxTokens: 2000 })
      const doc = { id: uuidv4(), userId: user.id, category, question, answer, evaluation: data, createdAt: new Date() }
      await db.collection('interview_answers').insertOne(doc)
      return j({ evaluation: data, answerId: doc.id })
    }
    // POST /interview/session — save a mock interview session
    if (route === '/interview/session' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, ...body, createdAt: new Date() }
      await db.collection('interview_sessions').insertOne(doc)
      return j({ session: clean(doc) })
    }
    if (route === '/interview/sessions' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('interview_sessions').find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).toArray()
      return j({ sessions: cleanArray(list) })
    }
    // GET /interview/progress — dashboard summary of interview practice
    if (route === '/interview/progress' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const [answers, sessions] = await Promise.all([
        db.collection('interview_answers').find({ userId: user.id }).project({ category: 1, 'evaluation.overallScore': 1, 'evaluation.communicationScore': 1, 'evaluation.confidenceScore': 1, 'evaluation.technicalScore': 1, 'evaluation.grammarScore': 1, createdAt: 1 }).limit(500).toArray(),
        db.collection('interview_sessions').find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).toArray(),
      ])
      const byCategory = {}
      answers.forEach(a => {
        const c = a.category || 'other'
        if (!byCategory[c]) byCategory[c] = { count: 0, avg: 0, scores: [] }
        byCategory[c].count++
        byCategory[c].scores.push(a.evaluation?.overallScore || 0)
      })
      Object.values(byCategory).forEach(v => { v.avg = v.scores.length ? Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length) : 0; delete v.scores })
      const timeline = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (29 - i))
        const key = d.toISOString().slice(0, 10)
        const scored = answers.filter(a => new Date(a.createdAt).toISOString().slice(0, 10) === key)
        return { date: key, count: scored.length, avg: scored.length ? Math.round(scored.reduce((s, a) => s + (a.evaluation?.overallScore || 0), 0) / scored.length) : 0 }
      })
      const dimensions = { communication: 0, confidence: 0, technical: 0, grammar: 0 }
      let n = 0
      answers.forEach(a => { if (a.evaluation?.overallScore) { n++; dimensions.communication += a.evaluation.communicationScore || 0; dimensions.confidence += a.evaluation.confidenceScore || 0; dimensions.technical += a.evaluation.technicalScore || 0; dimensions.grammar += a.evaluation.grammarScore || 0 } })
      if (n) Object.keys(dimensions).forEach(k => dimensions[k] = Math.round(dimensions[k] / n))
      return j({ totalAnswers: answers.length, totalSessions: sessions.length, byCategory, timeline, dimensions })
    }
    // POST /interview/learning-plan — generate a personalized 4-week study plan
    if (route === '/interview/learning-plan' && method === 'POST') {
      const rl = (await import('@/lib/ratelimit')).limit('llm', request.headers.get('x-forwarded-for') || 'anon')
      if (!rl.ok) return j({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` }, 429)
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const r = body.resumeId ? await db.collection('resumes').findOne({ id: body.resumeId, userId: user.id }) : null
      const recentAnswers = await db.collection('interview_answers').find({ userId: user.id }).sort({ createdAt: -1 }).project({ category: 1, 'evaluation.overallScore': 1, 'evaluation.improvements': 1 }).limit(30).toArray()
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are an expert interview prep coach. Design comprehensive study plans.',
        user: `Return JSON: { title (string), overview (string), weeks: [{ week (int), theme, days: [{ day (int), focus, tasks: [{ task, minutes, type ("read"|"practice"|"mock"|"review") }] }] }], resources: [{ name, url, type }], milestones (string[]) }.\nDesign a 4-week interview prep plan for ${body.targetRole || 'Software Engineer'}${body.company ? ' at ' + body.company : ''}. Focus tracks: ${(body.focusTracks || ['behavioral','technical','coding','system-design']).join(', ')}.\nCandidate strengths & weaknesses from recent practice:\n${JSON.stringify(recentAnswers).slice(0, 2000)}\n${r ? 'Resume:\n' + JSON.stringify(r.parsed).slice(0, 3000) : ''}`,
        maxTokens: 4500 })
      const doc = { id: uuidv4(), userId: user.id, targetRole: body.targetRole || '', company: body.company || '', plan: data, createdAt: new Date() }
      await db.collection('learning_plans').insertOne(doc)
      return j({ plan: clean(doc) })
    }
    if (route === '/interview/learning-plans' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('learning_plans').find({ userId: user.id }).sort({ createdAt: -1 }).limit(20).toArray()
      return j({ plans: cleanArray(list) })
    }

    // ============ EMAIL TEMPLATES ============
    if (route === '/crm/templates' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('email_templates').find({ $or: [{ userId: user.id }, { global: true }] }).sort({ createdAt: -1 }).limit(200).toArray()
      return j({ templates: cleanArray(list) })
    }
    if (route === '/crm/templates' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, name: body.name || 'Untitled', category: body.category || 'outreach', subject: body.subject || '', body: body.body || '', variables: body.variables || [], global: false, createdAt: new Date(), updatedAt: new Date() }
      await db.collection('email_templates').insertOne(doc)
      return j({ template: clean(doc) })
    }
    if (path[0] === 'crm' && path[1] === 'templates' && path.length === 3 && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      await db.collection('email_templates').updateOne({ id: path[2], userId: user.id }, { $set: { ...body, updatedAt: new Date() } })
      return j({ ok: true })
    }
    if (path[0] === 'crm' && path[1] === 'templates' && path.length === 3 && method === 'DELETE') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('email_templates').deleteOne({ id: path[2], userId: user.id })
      return j({ ok: true })
    }
    // Seed global templates if missing
    if (route === '/crm/templates/seed' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const existing = await db.collection('email_templates').countDocuments({ global: true })
      if (existing >= 4) return j({ ok: true, seeded: 0 })
      const seeds = [
        { name: 'Cold intro — recruiter', category: 'outreach', subject: 'Excited about {{role}} at {{company}}', body: 'Hi {{name}},\n\nI\'m {{yourName}} — a {{yourTitle}} with strong experience in {{keySkills}}. I saw {{company}} is hiring for {{role}} and wanted to reach out directly.\n\nA few highlights from my background: {{highlight1}}; {{highlight2}}.\n\nWould you have 15 min this week for a quick chat? I\'ve attached my resume for context.\n\nThanks,\n{{yourName}}', variables: ['name','role','company','yourName','yourTitle','keySkills','highlight1','highlight2'] },
        { name: 'Referral request', category: 'referral', subject: 'Quick referral ask — {{company}}', body: 'Hi {{name}},\n\nI\'ve admired your work at {{company}} and would love to be considered for the {{role}} role. My background in {{keySkills}} aligns well with what your team needs.\n\nWould you be open to referring me internally? Happy to send my resume and answer any questions.\n\nThanks,\n{{yourName}}', variables: ['name','company','role','keySkills','yourName'] },
        { name: 'Follow-up — no response', category: 'followup', subject: 'Following up on {{role}} at {{company}}', body: 'Hi {{name}},\n\nJust bubbling this up in your inbox in case my earlier note got buried. I remain excited about the {{role}} opportunity at {{company}} and would love to connect.\n\nHappy to work around your schedule.\n\nThanks,\n{{yourName}}', variables: ['name','role','company','yourName'] },
        { name: 'Thank-you — after interview', category: 'thankyou', subject: 'Thanks for the great conversation', body: 'Hi {{name}},\n\nThank you for taking the time to chat today. I loved learning more about {{topic}} and the team\'s goals around {{goal}}.\n\nOur discussion reinforced my excitement about the {{role}} role — I\'d bring {{strength}} to help push it forward.\n\nHappy to answer any follow-up questions.\n\nBest,\n{{yourName}}', variables: ['name','topic','goal','role','strength','yourName'] },
      ].map(t => ({ ...t, id: uuidv4(), userId: null, global: true, createdAt: new Date() }))
      await db.collection('email_templates').insertMany(seeds)
      return j({ ok: true, seeded: seeds.length })
    }

    // POST /interview/coding — generate a coding problem
    if (route === '/interview/coding' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { difficulty = 'medium', topic = 'general', language = 'javascript' } = body
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You author coding interview problems like a top FAANG interviewer.',
        user: `Return JSON: { title, difficulty, topic, statement (markdown), examples ([{ input, output, explanation }]), constraints (string[]), hints (string[]), solution (string, code in ${language}), timeComplexity, spaceComplexity }.\nGenerate a ${difficulty} ${topic} problem in ${language}.`,
        maxTokens: 3000 })
      return j({ problem: data })
    }
    // POST /interview/coding/evaluate — evaluate a coding solution
    if (route === '/interview/coding/evaluate' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { problem, code, language = 'javascript' } = body
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are a senior engineer reviewing coding interview solutions.',
        user: `Evaluate this ${language} solution. Return JSON: { correctness (0-100), efficiency (0-100), style (0-100), overallScore (0-100), bugs (string[]), improvements (string[]), edgeCasesMissed (string[]), betterApproach (string), verdict (string) }.\nProblem:\n${JSON.stringify(problem).slice(0, 2500)}\nSolution:\n${code}`,
        maxTokens: 2000 })
      return j({ evaluation: data })
    }
    // POST /interview/system-design — generate + evaluate
    if (route === '/interview/system-design' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      if (body.answer) {
        const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
          system: 'You are a staff engineer evaluating system-design interviews.',
          user: `Evaluate this system design answer. Return JSON: { overallScore, scalability, reliability, tradeoffs, architectureClarity, communication, strengths (string[]), gaps (string[]), improvements (string[]), verdict }.\nQuestion: ${body.question}\nAnswer: ${body.answer}`,
          maxTokens: 2500 })
        return j({ evaluation: data })
      }
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You author system design interview problems.',
        user: `Return JSON: { title, statement, requirements (functional/nonfunctional), keyComponents (string[]), constraints (string[]), hints (string[]), sampleArchitecture (string), tradeoffs (string[]) }. Difficulty: ${body.difficulty || 'senior'}. Topic: ${body.topic || 'random modern system'}.`,
        maxTokens: 2500 })
      return j({ problem: data })
    }

    // ============ RECRUITER CRM ============
    if (route === '/crm/contacts' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('contacts').find({ userId: user.id }).sort({ updatedAt: -1 }).limit(500).toArray()
      return j({ contacts: cleanArray(list) })
    }
    if (route === '/crm/contacts' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, name: body.name || '', title: body.title || '', company: body.company || '', email: body.email || '', linkedin: body.linkedin || '', phone: body.phone || '', notes: body.notes || '', tags: body.tags || [], messages: [], createdAt: new Date(), updatedAt: new Date() }
      await db.collection('contacts').insertOne(doc)
      return j({ contact: clean(doc) })
    }
    if (path[0] === 'crm' && path[1] === 'contacts' && path.length === 3 && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      await db.collection('contacts').updateOne({ id: path[2], userId: user.id }, { $set: { ...body, updatedAt: new Date() } })
      const fresh = await db.collection('contacts').findOne({ id: path[2], userId: user.id })
      return j({ contact: clean(fresh) })
    }
    if (path[0] === 'crm' && path[1] === 'contacts' && path.length === 3 && method === 'DELETE') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('contacts').deleteOne({ id: path[2], userId: user.id })
      return j({ ok: true })
    }
    if (route === '/crm/outreach' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const { contactId, purpose = 'introduction', jobTitle = '', company = '', resumeId, tone = 'professional' } = body
      const contact = contactId ? await db.collection('contacts').findOne({ id: contactId, userId: user.id }) : null
      const resume = resumeId ? await db.collection('resumes').findOne({ id: resumeId, userId: user.id }) : null
      const { content } = await chatCompletion({ provider: user.settings?.aiProvider || 'openai',
        messages: [
          { role: 'system', content: `Write a personalized cold outreach email. Tone: ${tone}. Keep it under 150 words. Use only real facts from the candidate resume. Sign as ${resume?.parsed?.name || user.name}.` },
          { role: 'user', content: `Contact: ${JSON.stringify(contact || {})}\nPurpose: ${purpose}\nRole: ${jobTitle} at ${company}\nCandidate resume:\n${JSON.stringify(resume?.parsed || {}).slice(0, 4000)}` },
        ],
        maxTokens: 800,
      })
      const doc = { id: uuidv4(), userId: user.id, contactId, subject: `${purpose === 'followup' ? 'Following up' : 'Introduction'} — ${jobTitle || 'Opportunity'}`, body: content, purpose, status: 'draft', createdAt: new Date() }
      await db.collection('crm_messages').insertOne(doc)
      if (contactId) {
        await db.collection('contacts').updateOne({ id: contactId }, { $push: { messages: { id: doc.id, subject: doc.subject, at: doc.createdAt } }, $set: { updatedAt: new Date() } })
      }
      return j({ message: clean(doc) })
    }
    // Follow-up scheduler
    if (route === '/crm/followup' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const doc = { id: uuidv4(), userId: user.id, contactId: body.contactId, applicationId: body.applicationId, dueDate: new Date(body.dueDate), note: body.note || 'Follow up', status: 'pending', createdAt: new Date() }
      await db.collection('followups').insertOne(doc)
      return j({ followup: clean(doc) })
    }
    if (route === '/crm/followups' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('followups').find({ userId: user.id }).sort({ dueDate: 1 }).limit(500).toArray()
      return j({ followups: cleanArray(list) })
    }
    if (path[0] === 'crm' && path[1] === 'followup' && path.length === 3 && method === 'PATCH') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      await db.collection('followups').updateOne({ id: path[2], userId: user.id }, { $set: { ...body, updatedAt: new Date() } })
      return j({ ok: true })
    }
    if (path[0] === 'crm' && path[1] === 'followup' && path.length === 3 && method === 'DELETE') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('followups').deleteOne({ id: path[2], userId: user.id })
      return j({ ok: true })
    }

    // ============ RESUME EXPORT (PDF/DOCX) ============
    if (path[0] === 'resumes' && path[2] === 'export' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json().catch(() => ({}))
      const format = (body.format || 'pdf').toLowerCase()
      const template = body.template || 'classic'
      const versionId = body.versionId
      let parsed
      if (versionId) {
        const v = await db.collection('resume_versions').findOne({ id: versionId, userId: user.id })
        if (!v) return j({ error: 'Version not found' }, 404)
        parsed = v.parsed
      } else {
        const r = await db.collection('resumes').findOne({ id: path[1], userId: user.id })
        if (!r) return j({ error: 'Not found' }, 404)
        parsed = r.parsed
      }
      const { resumeToPDF, resumeToDOCX } = await import('@/lib/export')
      let buffer, mime, ext
      if (format === 'docx') {
        buffer = await resumeToDOCX(parsed, template); mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; ext = 'docx'
      } else {
        buffer = resumeToPDF(parsed, template); mime = 'application/pdf'; ext = 'pdf'
      }
      const filename = `${(parsed.name || 'resume').replace(/\s+/g, '_')}_${template}.${ext}`
      return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"` } })
    }

    // ============ AI CAREER COPILOT ============
    // POST /copilot/scan — analyze resume + generate personalized recommendations
    if (route === '/copilot/scan' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const r = await db.collection('resumes').findOne({ id: body.resumeId, userId: user.id })
      if (!r) return j({ error: 'Resume required' }, 400)
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are an AI career copilot. Give honest, actionable, senior-level career advice grounded in real market trends.',
        user: `Analyze this candidate and return JSON: { careerLevel (string), ideal_next_roles (string[] of 3-5 realistic target titles), target_companies (string[] of 8-12 realistic target companies by tier: FAANG/scale-ups/well-funded startups), skills_to_learn (array of {skill, priority, why, resource}), certifications_recommended (array of {name, provider, cost_estimate, why}), interview_prep_topics (string[]), market_insights (string), estimated_salary_range ({currency, min, max, note}), red_flags (string[] — resume gaps/weaknesses).\nTargets country: ${body.country || 'United States'}.\nResume:\n${JSON.stringify(r.parsed).slice(0, 8000)}`,
        maxTokens: 4000 })
      const doc = { id: uuidv4(), userId: user.id, resumeId: r.id, country: body.country || 'United States', insights: data, createdAt: new Date() }
      await db.collection('copilot_scans').insertOne(doc)
      return j({ scan: clean(doc) })
    }
    if (route === '/copilot/scans' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('copilot_scans').find({ userId: user.id }).sort({ createdAt: -1 }).limit(20).toArray()
      return j({ scans: cleanArray(list) })
    }
    // POST /copilot/discover — continuously generate new matching jobs based on latest resume + create notifications
    if (route === '/copilot/discover' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const r = body.resumeId ? await db.collection('resumes').findOne({ id: body.resumeId, userId: user.id }) : (await db.collection('resumes').find({ userId: user.id }).sort({ updatedAt: -1 }).limit(1).toArray())[0]
      if (!r) return j({ error: 'No resume found. Upload one first.' }, 400)
      const country = body.country || user.settings?.locationPref || 'United States'
      // Get seen job titles/companies so we don't return duplicates
      const seen = await db.collection('discovered_jobs').find({ userId: user.id }).project({ title: 1, company: 1 }).limit(50).toArray()
      const seenList = seen.map(s => `${s.title} @ ${s.company}`).join('; ')
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are an AI career copilot that discovers new job opportunities matching the candidate. Return realistic listings with a match reason. Location must be in the specified country. Avoid duplicates from the recent list.',
        user: `Return JSON: { jobs: [{ id, title, company, companyLogo, location, workMode, country, city, salaryMin, salaryMax, currency, experience, visaSponsorship, skills, description (short), postedDaysAgo, source, applyUrl, matchScore (0-100), matchReason (string) }] }.\nReturn 6 fresh matching jobs in ${country} for this candidate.\nAvoid duplicates: ${seenList.slice(0, 800)}\nCandidate:\n${JSON.stringify(r.parsed).slice(0, 5000)}`,
        maxTokens: 4500 })
      const now = new Date()
      const jobs = (data.jobs || []).map(x => ({ ...x, id: x.id || uuidv4(), userId: user.id, resumeId: r.id, country, discoveredAt: now }))
      if (jobs.length) await db.collection('discovered_jobs').insertMany(jobs)
      // Create a notification
      if (jobs.length) {
        const top = jobs.slice(0, 3).map(x => `${x.title} at ${x.company}`).join(', ')
        await db.collection('notifications').insertOne({ id: uuidv4(), userId: user.id, type: 'copilot_discovery', title: `${jobs.length} new job matches`, body: top, read: false, meta: { count: jobs.length }, createdAt: now })
      }
      return j({ jobs: jobs.map(clean), count: jobs.length })
    }
    if (route === '/copilot/discovered' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('discovered_jobs').find({ userId: user.id }).sort({ discoveredAt: -1 }).limit(60).toArray()
      return j({ jobs: cleanArray(list) })
    }
    // POST /copilot/interview-prep — targeted interview prep from JD + resume
    if (route === '/copilot/interview-prep' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const body = await request.json()
      const r = body.resumeId ? await db.collection('resumes').findOne({ id: body.resumeId, userId: user.id }) : null
      const { data } = await chatJSON({ provider: user.settings?.aiProvider || 'openai',
        system: 'You are an interview preparation coach.',
        user: `Return JSON: { likely_questions: [{ category, question, why }], focus_topics (string[]), pitch_advice (string), star_examples: [{ situation_hint, from_your_experience }], red_flags_to_avoid (string[]), study_plan_week: [{ day, tasks (string[]) }] }.\nJob: ${body.jobTitle || ''} at ${body.company || ''}\nJD:\n${(body.jobDescription || '').slice(0, 3500)}\n${r ? 'Candidate:\n' + JSON.stringify(r.parsed).slice(0, 5000) : ''}`,
        maxTokens: 4000 })
      return j({ prep: data })
    }

    // ============ SUBSCRIPTION (no payment, just plan management) ============
    if (route === '/subscription' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const plans = [
        { id: 'free', name: 'Free', price: 0, features: ['3 resumes', '10 AI analyses/month', 'Basic job search', 'Interview coach (limited)'] },
        { id: 'pro', name: 'Pro', price: 19, features: ['Unlimited resumes', 'Unlimited AI analyses', 'Career Copilot', 'Voice interviews', 'Priority AI', 'Gmail/Graph integration'] },
        { id: 'team', name: 'Team', price: 49, features: ['Everything in Pro', '5 seats', 'Admin dashboard', 'Custom templates', 'API access'] },
      ]
      return j({ plans, current: user.plan || 'free' })
    }
    if (route === '/subscription' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const { plan } = await request.json()
      if (!['free', 'pro', 'team'].includes(plan)) return j({ error: 'Invalid plan' }, 400)
      await db.collection('users').updateOne({ id: user.id }, { $set: { plan, updatedAt: new Date() } })
      // Store subscription event
      await db.collection('subscription_events').insertOne({ id: uuidv4(), userId: user.id, plan, at: new Date(), note: 'Plan changed (dev mode)' })
      return j({ ok: true, plan })
    }

    // ============ INTEGRATIONS: GMAIL OAuth ============
    if (route === '/integrations/gmail/status' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      const conn = await db.collection('email_integrations').findOne({ userId: user.id, provider: 'gmail' })
      return j({ configured, connected: !!conn, email: conn?.email || null, missingEnv: configured ? [] : ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] })
    }
    if (route === '/integrations/gmail/connect' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      if (!process.env.GOOGLE_CLIENT_ID) return j({ error: 'Gmail integration not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment.' }, 400)
      const state = uuidv4()
      await db.collection('oauth_states').insertOne({ state, userId: user.id, provider: 'gmail', createdAt: new Date() })
      const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email')
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
      return j({ url })
    }
    if (route === '/integrations/gmail/callback' && method === 'GET') {
      const url = new URL(request.url)
      const appOrigin = process.env.NEXT_PUBLIC_BASE_URL || url.origin
      const code = url.searchParams.get('code'); const state = url.searchParams.get('state')
      if (!code || !state) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=missing_params`)
      const st = await db.collection('oauth_states').findOne({ state, provider: 'gmail' })
      if (!st) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=invalid_state`)
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) })
      const tokens = await tokenRes.json()
      if (!tokens.access_token) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=token_exchange_failed`)
      const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const me = await meRes.json()
      await db.collection('email_integrations').updateOne({ userId: st.userId, provider: 'gmail' }, { $set: { userId: st.userId, provider: 'gmail', email: me.email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000), updatedAt: new Date() } }, { upsert: true })
      await db.collection('oauth_states').deleteOne({ state })
      return NextResponse.redirect(`${appOrigin}/dashboard/integrations?connected=gmail`)
    }
    if (route === '/integrations/gmail/disconnect' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('email_integrations').deleteOne({ userId: user.id, provider: 'gmail' })
      return j({ ok: true })
    }
    if (route === '/integrations/gmail/send' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const { to, subject, body } = await request.json()
      const conn = await db.collection('email_integrations').findOne({ userId: user.id, provider: 'gmail' })
      if (!conn) return j({ error: 'Gmail not connected' }, 400)
      // Refresh token if expired
      let accessToken = conn.accessToken
      if (conn.expiresAt && new Date(conn.expiresAt) < new Date() && conn.refreshToken) {
        const rr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: conn.refreshToken, grant_type: 'refresh_token' }) })
        const rt = await rr.json()
        if (rt.access_token) {
          accessToken = rt.access_token
          await db.collection('email_integrations').updateOne({ _id: conn._id }, { $set: { accessToken, expiresAt: new Date(Date.now() + (rt.expires_in || 3600) * 1000) } })
        }
      }
      const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) })
      const data = await sendRes.json()
      if (!sendRes.ok) return j({ error: data?.error?.message || 'Send failed' }, 500)
      await db.collection('email_log').insertOne({ id: uuidv4(), userId: user.id, provider: 'gmail', to, subject, sentAt: new Date(), messageId: data.id })
      return j({ ok: true, messageId: data.id })
    }

    // ============ INTEGRATIONS: MICROSOFT GRAPH OAuth ============
    if (route === '/integrations/microsoft/status' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const configured = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
      const conn = await db.collection('email_integrations').findOne({ userId: user.id, provider: 'microsoft' })
      return j({ configured, connected: !!conn, email: conn?.email || null, missingEnv: configured ? [] : ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] })
    }
    if (route === '/integrations/microsoft/connect' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      if (!process.env.MICROSOFT_CLIENT_ID) return j({ error: 'Microsoft integration not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.' }, 400)
      const state = uuidv4()
      await db.collection('oauth_states').insertOne({ state, userId: user.id, provider: 'microsoft', createdAt: new Date() })
      const tenant = process.env.MICROSOFT_TENANT_ID || 'common'
      const scope = encodeURIComponent('offline_access User.Read Mail.Send Mail.Read')
      const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)}&response_mode=query&scope=${scope}&state=${state}`
      return j({ url })
    }
    if (route === '/integrations/microsoft/callback' && method === 'GET') {
      const url = new URL(request.url)
      const appOrigin = process.env.NEXT_PUBLIC_BASE_URL || url.origin
      const code = url.searchParams.get('code'); const state = url.searchParams.get('state')
      if (!code || !state) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=missing_params`)
      const st = await db.collection('oauth_states').findOne({ state, provider: 'microsoft' })
      if (!st) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=invalid_state`)
      const tenant = process.env.MICROSOFT_TENANT_ID || 'common'
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ code, client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, redirect_uri: process.env.MICROSOFT_REDIRECT_URI, grant_type: 'authorization_code', scope: 'offline_access User.Read Mail.Send Mail.Read' }) })
      const tokens = await tokenRes.json()
      if (!tokens.access_token) return NextResponse.redirect(`${appOrigin}/dashboard/integrations?error=token_exchange_failed`)
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const me = await meRes.json()
      await db.collection('email_integrations').updateOne({ userId: st.userId, provider: 'microsoft' }, { $set: { userId: st.userId, provider: 'microsoft', email: me.mail || me.userPrincipalName, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000), updatedAt: new Date() } }, { upsert: true })
      await db.collection('oauth_states').deleteOne({ state })
      return NextResponse.redirect(`${appOrigin}/dashboard/integrations?connected=microsoft`)
    }
    if (route === '/integrations/microsoft/disconnect' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      await db.collection('email_integrations').deleteOne({ userId: user.id, provider: 'microsoft' })
      return j({ ok: true })
    }
    if (route === '/integrations/microsoft/send' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const { to, subject, body } = await request.json()
      const conn = await db.collection('email_integrations').findOne({ userId: user.id, provider: 'microsoft' })
      if (!conn) return j({ error: 'Microsoft not connected' }, 400)
      let accessToken = conn.accessToken
      if (conn.expiresAt && new Date(conn.expiresAt) < new Date() && conn.refreshToken) {
        const tenant = process.env.MICROSOFT_TENANT_ID || 'common'
        const rr = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, refresh_token: conn.refreshToken, grant_type: 'refresh_token', scope: 'offline_access Mail.Send' }) })
        const rt = await rr.json()
        if (rt.access_token) {
          accessToken = rt.access_token
          await db.collection('email_integrations').updateOne({ _id: conn._id }, { $set: { accessToken, expiresAt: new Date(Date.now() + (rt.expires_in || 3600) * 1000) } })
        }
      }
      const graphBody = { message: { subject, body: { contentType: 'Text', content: body }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true }
      const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(graphBody) })
      if (!sendRes.ok) { const d = await sendRes.json().catch(() => ({})); return j({ error: d?.error?.message || 'Send failed' }, 500) }
      await db.collection('email_log').insertOne({ id: uuidv4(), userId: user.id, provider: 'microsoft', to, subject, sentAt: new Date() })
      return j({ ok: true })
    }
    if (route === '/integrations/email-log' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('email_log').find({ userId: user.id }).sort({ sentAt: -1 }).limit(50).toArray()
      return j({ emails: cleanArray(list) })
    }

    // ============ ANALYTICS ============
    if (route === '/analytics' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const [apps, resumes, interviews, contactsCount, coverLettersCount] = await Promise.all([
        db.collection('applications').find({ userId: user.id }).project({ status: 1, location: 1, company: 1, appliedDate: 1, createdAt: 1 }).limit(2000).toArray(),
        db.collection('resumes').find({ userId: user.id }).project({ atsScore: 1 }).limit(500).toArray(),
        db.collection('interview_answers').find({ userId: user.id }).project({ 'evaluation.overallScore': 1 }).limit(500).toArray(),
        db.collection('contacts').countDocuments({ userId: user.id }),
        db.collection('cover_letters').countDocuments({ userId: user.id }),
      ])
      const statusCount = apps.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a }, {})
      const totalApps = apps.length
      const interviewed = (statusCount.interview || 0) + (statusCount.assessment || 0) + (statusCount.offer || 0) + (statusCount.accepted || 0)
      const rejected = statusCount.rejected || 0
      const interviewRate = totalApps ? Math.round((interviewed / totalApps) * 100) : 0
      const responseRate = totalApps ? Math.round(((interviewed + rejected) / totalApps) * 100) : 0
      const bestAts = resumes.reduce((m, r) => Math.max(m, r.atsScore || 0), 0)
      const avgAts = resumes.length ? Math.round(resumes.reduce((s, r) => s + (r.atsScore || 0), 0) / resumes.length) : 0
      const byCountry = apps.reduce((a, x) => { const c = (x.location || '').split(',').pop().trim() || 'Unknown'; a[c] = (a[c] || 0) + 1; return a }, {})
      const byCompany = apps.reduce((a, x) => { a[x.company || 'Unknown'] = (a[x.company || 'Unknown'] || 0) + 1; return a }, {})
      const last30 = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (29 - i))
        const key = d.toISOString().slice(0, 10)
        return { date: key, count: apps.filter(a => new Date(a.appliedDate || a.createdAt).toISOString().slice(0, 10) === key).length }
      })
      const avgInterviewScore = interviews.length ? Math.round(interviews.reduce((s, i) => s + (i.evaluation?.overallScore || 0), 0) / interviews.length) : 0
      return j({ totals: { applications: totalApps, resumes: resumes.length, interviews: interviews.length, contacts: contactsCount, coverLetters: coverLettersCount }, statusCount, interviewRate, responseRate, bestAts, avgAts, avgInterviewScore, byCountry, byCompany, timeline: last30 })
    }

    // ============ NOTIFICATIONS ============
    if (route === '/notifications' && method === 'GET') {
      const { user, error } = await requireUser(request); if (error) return error
      const list = await db.collection('notifications').find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).toArray()
      return j({ notifications: cleanArray(list) })
    }
    if (route === '/notifications/read' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const { id } = await request.json()
      await db.collection('notifications').updateMany(id ? { id, userId: user.id } : { userId: user.id }, { $set: { read: true } })
      return j({ ok: true })
    }
    // POST /notifications/generate — scan applications + followups for due reminders (idempotent by dedup key)
    if (route === '/notifications/generate' && method === 'POST') {
      const { user, error } = await requireUser(request); if (error) return error
      const now = new Date()
      const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // next 3 days
      const created = []
      // Follow-up reminders
      const followups = await db.collection('followups').find({ userId: user.id, status: 'pending', dueDate: { $lte: soon } }).limit(100).toArray()
      for (const f of followups) {
        const dedup = `followup:${f.id}`
        const exists = await db.collection('notifications').findOne({ userId: user.id, dedup })
        if (exists) continue
        const contact = f.contactId ? await db.collection('contacts').findOne({ id: f.contactId, userId: user.id }) : null
        const doc = { id: uuidv4(), userId: user.id, type: 'followup', title: `Follow-up due: ${contact?.name || 'contact'}`, body: f.note || 'Time to follow up', dedup, meta: { followupId: f.id }, read: false, createdAt: new Date() }
        await db.collection('notifications').insertOne(doc); created.push(doc)
      }
      // Interview reminders (applications with interview status)
      const interviews = await db.collection('applications').find({ userId: user.id, status: 'interview' }).limit(50).toArray()
      for (const a of interviews) {
        const dedup = `interview:${a.id}`
        const exists = await db.collection('notifications').findOne({ userId: user.id, dedup })
        if (exists) continue
        const doc = { id: uuidv4(), userId: user.id, type: 'interview', title: `Interview: ${a.jobTitle} @ ${a.company}`, body: 'Prepare with the AI coach. Practice a mock interview.', dedup, meta: { applicationId: a.id }, read: false, createdAt: new Date() }
        await db.collection('notifications').insertOne(doc); created.push(doc)
      }
      // Resume analysis staleness (>14 days since analysis)
      const staleAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const stale = await db.collection('resumes').find({ userId: user.id, atsScore: { $ne: null }, updatedAt: { $lt: staleAgo } }).limit(5).toArray()
      for (const r of stale) {
        const updatedIso = r.updatedAt instanceof Date ? r.updatedAt.toISOString().slice(0, 10) : String(r.updatedAt || '').slice(0, 10)
        const dedup = `resume-stale:${r.id}:${updatedIso}`
        const exists = await db.collection('notifications').findOne({ userId: user.id, dedup })
        if (exists) continue
        const doc = { id: uuidv4(), userId: user.id, type: 'resume_stale', title: `Refresh "${r.title}"`, body: 'Your ATS analysis is 2+ weeks old. Re-run to catch new keyword trends.', dedup, meta: { resumeId: r.id }, read: false, createdAt: new Date() }
        await db.collection('notifications').insertOne(doc); created.push(doc)
      }
      return j({ ok: true, created: created.length, notifications: created.map(clean) })
    }

    // ============ ADMIN — AUDIT LOGS + FEATURE FLAGS + SUBSCRIPTIONS ============
    if (route === '/admin/audit-logs' && method === 'GET') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const url = new URL(request.url)
      const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100'))
      const logs = await db.collection('audit_logs').find({}).sort({ at: -1 }).limit(limit).toArray()
      // Enrich with user email
      const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))]
      const users = await db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, email: 1, name: 1 }).limit(500).toArray()
      const uMap = Object.fromEntries(users.map(u => [u.id, u]))
      return j({ logs: logs.map(l => ({ ...clean(l), user: uMap[l.userId] ? { email: uMap[l.userId].email, name: uMap[l.userId].name } : null })) })
    }
    if (route === '/admin/feature-flags' && method === 'GET') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const list = await db.collection('feature_flags').find({}).limit(50).toArray()
      // Ensure defaults
      const defaults = [
        { key: 'career_copilot', enabled: true, description: 'AI Career Copilot (recommendations, discovery)' },
        { key: 'coding_playground', enabled: true, description: 'Monaco-powered coding playground' },
        { key: 'whiteboard', enabled: true, description: 'System design whiteboard' },
        { key: 'live_job_search', enabled: true, description: 'Real-time job search via Greenhouse/Lever/Ashby/RemoteOK' },
        { key: 'gmail_integration', enabled: true, description: 'Gmail OAuth for outreach' },
        { key: 'microsoft_integration', enabled: true, description: 'Microsoft Graph OAuth for outreach' },
        { key: 'voice_interview', enabled: true, description: 'Voice input on interview coach' },
      ]
      const existing = new Set(list.map(f => f.key))
      const missing = defaults.filter(d => !existing.has(d.key)).map(d => ({ ...d, id: uuidv4(), createdAt: new Date() }))
      if (missing.length) await db.collection('feature_flags').insertMany(missing)
      const all = await db.collection('feature_flags').find({}).limit(50).toArray()
      return j({ flags: cleanArray(all) })
    }
    if (route === '/admin/feature-flags' && method === 'PATCH') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const { key, enabled } = await request.json()
      await db.collection('feature_flags').updateOne({ key }, { $set: { enabled: !!enabled, updatedAt: new Date() } })
      await db.collection('audit_logs').insertOne({ id: uuidv4(), userId: user.id, action: 'admin.flag_toggle', meta: { key, enabled }, at: new Date() })
      return j({ ok: true })
    }
    // Public flags endpoint (no admin required) — used by client to gate UI
    if (route === '/feature-flags' && method === 'GET') {
      const list = await db.collection('feature_flags').find({}).project({ key: 1, enabled: 1 }).limit(50).toArray()
      return j({ flags: Object.fromEntries(list.map(f => [f.key, f.enabled])) })
    }
    if (route === '/admin/subscriptions' && method === 'GET') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const users = await db.collection('users').find({}).project({ id: 1, email: 1, name: 1, plan: 1, createdAt: 1 }).limit(1000).toArray()
      const grouped = users.reduce((a, u) => { const p = u.plan || 'free'; if (!a[p]) a[p] = { count: 0, users: [] }; a[p].count++; a[p].users.push({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt }); return a }, {})
      return j({ byPlan: grouped, total: users.length })
    }
    if (route === '/admin/users' && method === 'GET') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const users = await db.collection('users').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      const clean = users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan, provider: u.provider, createdAt: u.createdAt }))
      return j({ users: clean })
    }
    if (route === '/admin/stats' && method === 'GET') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const [users, apps, resumes, interviews] = await Promise.all([
        db.collection('users').countDocuments(),
        db.collection('applications').countDocuments(),
        db.collection('resumes').countDocuments(),
        db.collection('interview_answers').countDocuments(),
      ])
      return j({ users, applications: apps, resumes, interviews })
    }
    if (path[0] === 'admin' && path[1] === 'user' && path.length === 3 && method === 'PATCH') {
      const { user, error } = await requireAdmin(request); if (error) return error
      const body = await request.json()
      await db.collection('users').updateOne({ id: path[2] }, { $set: { ...body, updatedAt: new Date() } })
      return j({ ok: true })
    }

    return j({ error: `Route ${route} not found` }, 404)
  } catch (e) {
    console.error('API Error:', e)
    return j({ error: e.message || 'Internal server error' }, 500)
  }
}

function pubUser(u) { return { id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role, plan: u.plan, settings: u.settings } }

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
