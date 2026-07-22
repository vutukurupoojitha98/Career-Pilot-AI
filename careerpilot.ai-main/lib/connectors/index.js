// Registry + aggregator across all connectors.
import * as remoteok from './remoteok'
import * as greenhouse from './greenhouse'
import * as lever from './lever'
import * as ashby from './ashby'
import * as wellfound from './wellfound'
import * as careerSites from './career-sites'

export const CONNECTORS = {
  remoteok: { name: 'RemoteOK', search: remoteok.search, live: true },
  greenhouse: { name: 'Greenhouse', search: greenhouse.search, live: true },
  lever: { name: 'Lever', search: lever.search, live: true },
  ashby: { name: 'Ashby', search: ashby.search, live: true },
  wellfound: { name: 'Wellfound', search: wellfound.search, live: false },
  career_sites: { name: 'Company Career Pages', search: careerSites.search, live: false },
}

export async function aggregate({ query, location, providers = Object.keys(CONNECTORS), limit = 40, llmProvider }) {
  const results = await Promise.all(providers.map(async key => {
    const c = CONNECTORS[key]
    if (!c) return { key, jobs: [] }
    try {
      const r = await c.search({ query, location, provider: llmProvider, limit: Math.ceil(limit / providers.length) + 4 })
      return { key, jobs: r.jobs || [] }
    } catch (e) {
      return { key, jobs: [], error: e.message }
    }
  }))
  const all = results.flatMap(r => r.jobs)
  // Deduplicate by title+company
  const seen = new Set()
  const dedup = []
  for (const j of all) {
    const k = (j.title + '::' + j.company).toLowerCase()
    if (seen.has(k)) continue
    seen.add(k); dedup.push(j)
  }
  return { jobs: dedup.slice(0, limit), bySource: Object.fromEntries(results.map(r => [r.key, r.jobs.length])) }
}
