// Ashby connector — uses public jobs API
// https://api.ashbyhq.com/posting-api/job-board/{orgName}
import { normalize, daysBetween, inferExperience, inferWorkMode, parseLocation } from './base'

const KNOWN = [
  { org: 'vercel', name: 'Vercel' },
  { org: 'anthropic', name: 'Anthropic' },
  { org: 'openai', name: 'OpenAI' },
  { org: 'perplexity', name: 'Perplexity' },
  { org: 'ramp', name: 'Ramp' },
  { org: 'linear', name: 'Linear' },
  { org: 'framer', name: 'Framer' },
  { org: 'posthog', name: 'PostHog' },
]

export async function search({ query = '', location = '', limit = 20 } = {}) {
  const jobs = []
  const q = query.toLowerCase()
  const locLower = (location || '').toLowerCase()
  await Promise.all(KNOWN.map(async company => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company.org}?includeCompensation=true`, { next: { revalidate: 900 } })
      if (!res.ok) return
      const data = await res.json()
      ;(data.jobs || []).forEach(j => {
        const title = j.title || ''
        const loc = j.location || ''
        if (q && !(title + ' ' + loc).toLowerCase().includes(q)) return
        if (locLower && !loc.toLowerCase().includes(locLower)) return
        const p = parseLocation(loc)
        const comp = j.compensation?.compensationTierSummary || ''
        const salaryMatch = comp.match(/\$?([\d,]+)\s*[-–]\s*\$?([\d,]+)/)
        jobs.push(normalize({
          id: 'ashby_' + j.id,
          title,
          company: company.name,
          location: loc,
          workMode: j.isRemote ? 'remote' : inferWorkMode(loc),
          country: p.country, state: p.state, city: p.city,
          salaryMin: salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, '')) : null,
          salaryMax: salaryMatch ? parseInt(salaryMatch[2].replace(/,/g, '')) : null,
          currency: 'USD',
          experience: inferExperience(title),
          skills: j.secondaryLocations?.map(l => l.location) || [],
          description: (j.descriptionPlain || '').slice(0, 800),
          postedDaysAgo: daysBetween(j.publishedAt),
          source: 'Ashby',
          applyUrl: j.jobUrl || j.applyUrl,
        }))
      })
    } catch (e) { /* skip */ }
  }))
  return { jobs: jobs.slice(0, limit) }
}
