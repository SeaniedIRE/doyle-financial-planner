import api from './client'

export const askClaude = (question: string, includeContext = true, year = 2026) =>
  api.post<{ response: string }>('/ai/ask', {
    question,
    include_portfolio_context: includeContext,
    year,
  }).then(r => r.data.response)

export const validateStrategy = (name: string, description: string, actions: string[]) =>
  api.post<{ response: string }>('/ai/validate-strategy', { name, description, actions }).then(r => r.data.response)

export const getLossHarvestAdvice = (holdingId: number) =>
  api.post<{ response: string }>(`/ai/loss-harvest-advice/${holdingId}`).then(r => r.data.response)

export const getFHSAStrategy = (houseYear: number, housePrice: number) =>
  api.get<{ response: string }>(`/ai/fhsa-strategy?house_year=${houseYear}&house_price=${housePrice}`).then(r => r.data.response)

export const getAnnualReview = (year: number) =>
  api.get<{ response: string }>(`/ai/annual-review/${year}`).then(r => r.data.response)

export const getLossHarvestAll = (marginalRate = 53, ytdGains = 0) =>
  api.get(`/acb/loss-harvest/analysis?marginal_rate=${marginalRate}&ytd_gains=${ytdGains}`).then(r => r.data)

// ── API key management ────────────────────────────────────────────────
// The key value is never returned — only configured status and source.

export const getAIKeyStatus = () =>
  api.get<{ configured: boolean; source: 'env' | 'db' | 'none' }>('/ai/key-status').then(r => r.data)

export const setAIKey = (apiKey: string) =>
  api.post<{ message: string }>('/ai/set-key', { api_key: apiKey }).then(r => r.data)
