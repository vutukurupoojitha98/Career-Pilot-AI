# CareerPilot AI 🚀

**Your always-on AI career copilot.** Optimize resumes, discover jobs, tailor applications, ace interviews, manage relationships, and track your entire pipeline — powered by GPT-5, Claude Sonnet 4.5, and Gemini 2.5 Pro (switchable in Settings).

---

## Features

### 🧠 AI Career Copilot
- Analyzes your resume + market position
- Continuously discovers new matching jobs in your target country
- Recommends skills, certifications, and career moves
- Generates personalized interview prep from any JD

### 📄 Resume Suite
- Upload PDF/DOCX with structured AI parsing
- ATS Analyzer (grammar, formatting, keywords, recruiter appeal, salary estimate)
- AI Optimizer (fact-grounded — never invents experience)
- Job-specific Tailoring
- Multi-version history
- Export to PDF/DOCX in 3 ATS-friendly templates (Classic, Modern, Minimal)

### 🔍 Jobs
- Location-first search (country/state/city/remote/hybrid/onsite/visa)
- AI-generated realistic listings (Greenhouse, Lever, Ashby, Wellfound, RemoteOK, company sites)
- Per-job AI match scores with skill gaps + improvement suggestions

### 📬 Applications
- Kanban / Timeline / Calendar views
- 7 status stages (Saved → Applied → Assessment → Interview → Offer → Accepted / Rejected)
- Event log per application

### ✉️ Cover Letters
- 5 styles × 4 tones
- Grounded strictly in your resume facts
- Copy / download

### 🎤 Interview Coach
- 6 categories: HR, Behavioral, Technical, Coding, System Design, Managerial
- Voice input (Web Speech API)
- Per-answer AI evaluation: overall, communication, confidence, technical, grammar scores
- Full coding IDE + system design workspace
- Session history & progress dashboard

### 🤝 Recruiter CRM
- Contact management
- AI-generated personalized outreach (cold intro, referral, follow-up, thank-you)
- Follow-up scheduler
- Message history per contact

### 📧 Email Integrations
- Gmail OAuth (send from Gmail API)
- Microsoft Graph OAuth (send from Outlook / Exchange)
- Send log & auto token refresh

### 📊 Analytics
- Timeline of applications (30-day)
- Pipeline status pie chart
- Top countries + companies
- Interview performance metrics

### 🔔 Notifications
- New job discoveries
- Interview reminders
- Follow-up alerts

### 🔒 Auth & Security
- JWT + bcrypt email/password
- Emergent Google OAuth
- HTTP-only cookies, MongoDB session store with TTL
- Role-based (user / admin)

### 💳 Subscription (dev-mode)
- Free / Pro / Team tiers
- Plan selector in Settings (Stripe integration deferred)

### 🌐 Chrome Extension
- Detect job info from Greenhouse, Lever, Ashby, Wellfound, RemoteOK, LinkedIn, Workday
- One-click save-to-tracker
- Inline AI match scoring
- Download from Settings → Chrome Extension

### 🎨 UI
- Apple-quality glassmorphic design
- Framer Motion animations
- Light + Dark modes
- Mobile-first responsive
- shadcn/ui + Tailwind

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript-ready, Tailwind CSS, shadcn/ui, framer-motion, react-query, recharts, sonner |
| Backend | Next.js API routes (catch-all `/api/[[...path]]`) |
| Database | MongoDB (schema-portable to PostgreSQL) |
| Auth | JWT + bcryptjs + HTTP-only cookies, MongoDB session store |
| File parsing | pdfjs-dist (PDF), mammoth (DOCX) |
| Export | jspdf (PDF), docx (Word) |
| AI | Emergent LLM proxy → GPT-5 / Claude Sonnet 4.5 / Gemini 2.5 Pro |
| Deploy | Ready for Emergent one-click deploy |

---

## Environment Variables

```bash
# Required
MONGO_URL=mongodb://localhost:27017
DB_NAME=careerpilot_ai
NEXT_PUBLIC_BASE_URL=https://your-app.example.com
JWT_SECRET=<long-random-string>
EMERGENT_LLM_KEY=<your-emergent-llm-key>
INTEGRATION_PROXY_URL=https://integrations.emergentagent.com
ADMIN_EMAIL=admin@yourdomain.com

# Optional — Gmail integration (Google Cloud Console → OAuth 2.0 Client ID → Web app)
GOOGLE_CLIENT_ID=<...>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<...>
GOOGLE_REDIRECT_URI=https://your-app.example.com/api/integrations/gmail/callback

# Optional — Microsoft Graph integration (Azure AD app registration → Redirect URI Web)
MICROSOFT_CLIENT_ID=<...>
MICROSOFT_CLIENT_SECRET=<...>
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://your-app.example.com/api/integrations/microsoft/callback
```

---

## MongoDB Collections

`users`, `sessions`, `resumes`, `resume_versions`, `resume_analyses`, `jobs`, `saved_jobs`, `job_searches`, `applications`, `cover_letters`, `interview_answers`, `interview_sessions`, `contacts`, `crm_messages`, `followups`, `notifications`, `copilot_scans`, `discovered_jobs`, `email_integrations`, `oauth_states`, `email_log`, `subscription_events`

Every doc uses UUIDs — no MongoDB ObjectIds are exposed. Passwords are bcrypt-hashed and never returned.

---

## API Highlights

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/signup` | Email/password signup |
| `POST /api/auth/login` | Email/password login |
| `POST /api/auth/emergent/session` | Emergent Google OAuth handoff |
| `POST /api/resumes/upload` | Upload PDF/DOCX + AI parse |
| `POST /api/resumes/:id/analyze` | ATS analysis |
| `POST /api/resumes/:id/optimize` | AI optimize (fact-grounded) |
| `POST /api/resumes/:id/tailor` | Tailor to JD |
| `POST /api/resumes/:id/export` | PDF/DOCX in 3 templates |
| `POST /api/jobs/search` | Location-filtered AI job search |
| `POST /api/jobs/match` | Resume ↔ job match with skill gaps |
| `POST /api/copilot/scan` | Full career analysis |
| `POST /api/copilot/discover` | Continuous new-job discovery (creates notification) |
| `POST /api/copilot/interview-prep` | Personalized prep plan from JD |
| `POST /api/cover-letter/generate` | AI cover letters, style/tone |
| `POST /api/interview/questions` | Generate questions (6 categories) |
| `POST /api/interview/evaluate` | Score behavioral/HR answers |
| `POST /api/interview/coding` + `.../evaluate` | Coding problem + solution eval |
| `POST /api/interview/system-design` | System design problem + eval |
| `GET/POST /api/crm/contacts` | Recruiter CRM |
| `POST /api/crm/outreach` | AI-generated personalized cold email |
| `POST /api/integrations/gmail/send` | Send via Gmail API |
| `POST /api/integrations/microsoft/send` | Send via Microsoft Graph |
| `GET /api/analytics` | Full dashboard analytics |
| `GET /api/admin/stats` + `/api/admin/users` | Admin dashboard |

---

## Development

```bash
yarn install
# .env already contains sensible defaults
sudo supervisorctl restart nextjs
```

Then visit `http://localhost:3000`.

**Auto-admin role:** any signup email matching `ADMIN_EMAIL` becomes admin.

---

## Roadmap (not yet shipped)

- Stripe checkout for paid tiers (backend structure ready)
- Automated form-fill via extension (Workday/Greenhouse/Lever)
- Email reply tracking via Gmail push notifications
- Multi-language resume support
