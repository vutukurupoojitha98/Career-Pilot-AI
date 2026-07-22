// Lever connector — uses public postings API per company
// https://api.lever.co/v0/postings/{company}?mode=json
import { normalize, daysBetween, inferExperience, inferWorkMode, parseLocation } from './base'

const KNOWN = [
  { slug: 'ramp', name: 'Ramp' },
  { slug: 'plaid', name: 'Plaid' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'attentive', name: 'Attentive' },
  { slug: 'anrok', name: 'Anrok' },
  { slug: 'writer', name: 'Writer' },
  { slug: 'mercury', name: 'Mercury' },
  { slug: 'linear', name: 'Linear' },
  { slug: 'retool', name: 'Retool' },
]

export async function search({ query = '', location = '', limit = 20 } = {}) {
  const jobs = []
  const q = query.toLowerCase()
  const locLower = (location || '').toLowerCase()
  await Promise.all(KNOWN.map(async company => {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${company.slug}?mode=json`, { next: { revalidate: 900 } })
      if (!res.ok) return
      const data = await res.json()
      ;(data || []).forEach(j => {
        const title = j.text || ''
        const loc = j.categories?.location || ''
        if (q && !(title + ' ' + loc).toLowerCase().includes(q)) return
        if (locLower && !loc.toLowerCase().includes(locLower)) return
        const p = parseLocation(loc)
        jobs.push(normalize({
          id: 'lever_' + j.id,
          title,
          company: company.name,
          location: loc,
          workMode: inferWorkMode(j.workplaceType + ' ' + loc + ' ' + title),
          country: p.country, state: p.state, city: p.city,
          experience: inferExperience(title),
          skills: [],
          description: (j.descriptionPlain || '').slice(0, 800),
          postedDaysAgo: daysBetween(new Date(j.createdAt).toISOString()),
          source: 'Lever',
          applyUrl: j.hostedUrl,
        }))
      })
    } catch (e) { /* skip */ }
  }))
  return { jobs: jobs.slice(0, limit) }
}
