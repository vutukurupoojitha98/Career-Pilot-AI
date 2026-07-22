// Wellfound (AngelList) connector — AI-generated fallback since no public API
import { chatJSON } from '../llm'
import { normalize } from './base'
import { v4 as uuidv4 } from 'uuid'

export async function search({ query = '', location = '', provider = 'openai', limit = 8 } = {}) {
  try {
    const { data } = await chatJSON({ provider,
      system: 'You know current Wellfound (AngelList) startup job listings. Generate realistic, current listings.',
      user: `Return JSON: { jobs: [{ title, company, location, workMode, salaryMin, salaryMax, currency, experience, skills (string[]), description (short), postedDaysAgo, applyUrl (https://wellfound.com/jobs/...) }] }.
Return ${limit} realistic Wellfound startup jobs matching:
Query: ${query}
Location: ${location || 'any'}`,
      maxTokens: 3000 })
    return { jobs: (data.jobs || []).map(j => normalize({ ...j, id: 'wellfound_' + uuidv4(), source: 'Wellfound' })) }
  } catch (e) {
    return { jobs: [] }
  }
}
