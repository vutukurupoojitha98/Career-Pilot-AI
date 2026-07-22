// RemoteOK connector — uses public JSON feed at https://remoteok.com/api
import { normalize, daysBetween, inferExperience } from './base'

export async function search({ query = '', location = '', limit = 30 } = {}) {
  try {
    const res = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'CareerPilotAI/1.0' }, next: { revalidate: 900 } })
    if (!res.ok) return { jobs: [] }
    const data = await res.json()
    // First item is often metadata
    const raw = Array.isArray(data) ? data.filter(j => j && j.position) : []
    const q = query.toLowerCase()
    const filtered = raw.filter(j => !q || (j.position + ' ' + (j.tags || []).join(' ') + ' ' + (j.description || '')).toLowerCase().includes(q))
    return {
      jobs: filtered.slice(0, limit).map(j => normalize({
        id: 'remoteok_' + j.id,
        title: j.position,
        company: j.company,
        companyLogo: j.company_logo || (j.company || '').slice(0, 2).toUpperCase(),
        location: j.location || 'Worldwide',
        workMode: 'remote',
        country: j.location || '',
        salaryMin: j.salary_min || null,
        salaryMax: j.salary_max || null,
        currency: 'USD',
        experience: inferExperience(j.position),
        skills: j.tags || [],
        description: (j.description || '').replace(/<[^>]+>/g, '').slice(0, 800),
        postedDaysAgo: daysBetween(j.date),
        source: 'RemoteOK',
        applyUrl: j.url || j.apply_url || `https://remoteok.com/l/${j.id}`,
      })),
    }
  } catch (e) {
    console.warn('RemoteOK error:', e.message)
    return { jobs: [] }
  }
}
