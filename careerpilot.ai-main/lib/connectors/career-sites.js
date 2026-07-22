// Company Career Pages — AI-generated fallback (real scraping requires per-site adapters)
import { chatJSON } from '../llm'
import { normalize } from './base'
import { v4 as uuidv4 } from 'uuid'

export async function search({ query = '', location = '', provider = 'openai', limit = 6 } = {}) {
  try {
    const { data } = await chatJSON({ provider,
      system: 'You return realistic job openings scraped from major company career pages (Google, Meta, Apple, Netflix, Amazon, Microsoft, etc.). Only well-known companies.',
      user: `Return JSON: { jobs: [{ title, company, location, workMode, salaryMin, salaryMax, currency, experience, skills (string[]), description (short), postedDaysAgo, applyUrl (https://{company}.careers/... style) }] }.
Return ${limit} realistic career-page jobs matching:
Query: ${query}
Location: ${location || 'any'}`,
      maxTokens: 3000 })
    return { jobs: (data.jobs || []).map(j => normalize({ ...j, id: 'career_' + uuidv4(), source: 'Company Site' })) }
  } catch (e) {
    return { jobs: [] }
  }
}
