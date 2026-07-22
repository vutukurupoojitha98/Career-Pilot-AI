// Universal LLM router — routes to OpenAI, Anthropic, or Google via Emergent proxy
// Compatible with OpenAI chat completions API

const PROXY = process.env.INTEGRATION_PROXY_URL || 'https://integrations.emergentagent.com'
const KEY = process.env.EMERGENT_LLM_KEY

export const MODELS = {
  openai: {
    label: 'OpenAI GPT-5',
    model: 'gpt-5',
    fast: 'gpt-4o-mini',
  },
  anthropic: {
    label: 'Claude Sonnet 4.5',
    model: 'claude-sonnet-4-5-20250929',
    fast: 'claude-sonnet-4-5-20250929',
  },
  google: {
    label: 'Gemini 2.5 Pro',
    model: 'gemini/gemini-2.5-pro',
    fast: 'gemini/gemini-2.5-pro',
  },
}

export function resolveModel(provider, opts = {}) {
  const p = MODELS[provider] || MODELS.openai
  return opts.fast ? p.fast : p.model
}

export async function chatCompletion({ provider = 'openai', model, messages, jsonMode = false, temperature = 0.4, maxTokens = 3000, fast = false }) {
  const useModel = model || resolveModel(provider, { fast })
  const body = {
    model: useModel,
    messages,
    max_tokens: maxTokens,
  }
  // GPT-5 only supports temperature=1 (default). Only include temperature for other models.
  if (!/^gpt-5/i.test(useModel)) {
    body.temperature = temperature
  } else {
    // GPT-5 uses reasoning tokens; keep effort minimal for fast structured output
    body.reasoning_effort = 'minimal'
    // GPT-5 uses max_completion_tokens instead of max_tokens
    body.max_completion_tokens = Math.max(maxTokens, 4000)
    delete body.max_tokens
  }
  if (jsonMode && provider === 'openai') {
    body.response_format = { type: 'json_object' }
  }
  const res = await fetch(`${PROXY}/llm/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`LLM error ${res.status}: ${txt.slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return { content, raw: data, model: useModel }
}

export async function chatJSON({ provider = 'openai', model, system, user, temperature = 0.3, maxTokens = 3500, fast = false }) {
  const messages = [
    { role: 'system', content: (system || '') + '\nRespond with ONLY valid minified JSON, no markdown, no code fences, no commentary.' },
    { role: 'user', content: user },
  ]
  const { content, model: usedModel } = await chatCompletion({ provider, model, messages, jsonMode: true, temperature, maxTokens, fast })
  // Strip code fences if present
  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
  }
  // Find first { and last }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }
  try {
    return { data: JSON.parse(cleaned), model: usedModel }
  } catch (e) {
    throw new Error('LLM did not return valid JSON: ' + cleaned.slice(0, 200))
  }
}
