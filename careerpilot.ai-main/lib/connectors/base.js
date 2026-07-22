// Base connector interface for job board integrations.
// All connectors implement: async search({ query, location, remote, limit }) -> { jobs: NormalizedJob[] }
// NormalizedJob shape:
// { id, title, company, companyLogo, location, workMode, country, state, city,
//   salaryMin, salaryMax, currency, experience, visaSponsorship, skills, description,
//   postedDaysAgo, source, applyUrl }

export function daysBetween(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function inferWorkMode(text = '') {
  const t = text.toLowerCase()
  if (/\bremote\b/.test(t) && !/no remote|hybrid only/.test(t)) return 'remote'
  if (/hybrid/.test(t)) return 'hybrid'
  if (/on[- ]?site|in[- ]?office/.test(t)) return 'onsite'
  return 'onsite'
}

export function inferExperience(title = '') {
  const t = title.toLowerCase()
  if (/staff|principal|distinguished|architect/.test(t)) return 'staff'
  if (/senior|sr\.|lead/.test(t)) return 'senior'
  if (/junior|jr\.|intern|entry|graduate/.test(t)) return 'entry'
  return 'mid'
}

export function parseLocation(loc = '') {
  const parts = loc.split(',').map(s => s.trim()).filter(Boolean)
  return { city: parts[0] || '', state: parts[1] || '', country: parts[2] || parts[1] || '' }
}

export function normalize(x) {
  return {
    id: x.id,
    title: x.title,
    company: x.company,
    companyLogo: x.companyLogo || (x.company || '').slice(0, 2).toUpperCase(),
    location: x.location || '',
    workMode: x.workMode || 'onsite',
    country: x.country || '',
    state: x.state || '',
    city: x.city || '',
    salaryMin: x.salaryMin || null,
    salaryMax: x.salaryMax || null,
    currency: x.currency || 'USD',
    experience: x.experience || 'mid',
    visaSponsorship: !!x.visaSponsorship,
    skills: x.skills || [],
    description: x.description || '',
    postedDaysAgo: x.postedDaysAgo || 0,
    source: x.source,
    applyUrl: x.applyUrl || '',
  }
}
