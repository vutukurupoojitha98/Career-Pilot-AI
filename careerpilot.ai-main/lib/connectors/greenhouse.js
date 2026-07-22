// Greenhouse connector — uses public boards API per company
// https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
import { normalize, daysBetween, inferExperience, inferWorkMode, parseLocation } from './base'

const KNOWN = [
  { token: 'stripe', name: 'Stripe' },
  { token: 'airbnb', name: 'Airbnb' },
  { token: 'coinbase', name: 'Coinbase' },
  { token: 'doordash', name: 'DoorDash' },
  { token: 'instacart', name: 'Instacart' },
  { token: 'discord', name: 'Discord' },
  { token: 'gitlab', name: 'GitLab' },
  { token: 'figma', name: 'Figma' },
  { token: 'reddit', name: 'Reddit' },
  { token: 'robinhood', name: 'Robinhood' },
  { token: 'shopify', name: 'Shopify' },
  { token: 'brex', name: 'Brex' },
]

export async function search({ query = '', location = '', limit = 20 } = {}) {
  const jobs = []
  const q = query.toLowerCase()
  const locLower = (location || '').toLowerCase()
  await Promise.all(KNOWN.map(async company => {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=false`, { next: { revalidate: 900 } })
      if (!res.ok) return
      const data = await res.json()
      ;(data.jobs || []).forEach(j => {
        const title = j.title || ''
        const loc = j.location?.name || ''
        if (q && !(title + ' ' + loc).toLowerCase().includes(q)) return
        if (locLower && !loc.toLowerCase().includes(locLower)) return
        const p = parseLocation(loc)
        jobs.push(normalize({
          id: 'greenhouse_' + j.id,
          title,
          company: company.name,
          location: loc,
          workMode: inferWorkMode(loc + ' ' + title),
          country: p.country, state: p.state, city: p.city,
          experience: inferExperience(title),
          skills: [],
          description: '',
          postedDaysAgo: daysBetween(j.updated_at),
          source: 'Greenhouse',
          applyUrl: j.absolute_url,
        }))
      })
    } catch (e) { /* skip */ }
  }))
  return { jobs: jobs.slice(0, limit) }
}
