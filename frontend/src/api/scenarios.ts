import api from './client'
import type { Scenario, ForecastSnapshot } from '../types'

export const getScenarios = () => api.get<Scenario[]>('/scenarios/').then(r => r.data)
export const createScenario = (data: Partial<Scenario>) => api.post<Scenario>('/scenarios/', data).then(r => r.data)
export const updateScenario = (id: number, data: Partial<Scenario>) => api.put(`/scenarios/${id}`, data).then(r => r.data)
export const deleteScenario = (id: number) => api.delete(`/scenarios/${id}`)

export const runForecast = (
  scenarioId: number,
  params: {
    start_year?: number
    end_year?: number
    mat_leave_1_year?: number
    mat_leave_2_year?: number
    sean_margin_loan?: number
    saudya_margin_loan?: number
    margin_rate?: number
    sean_canada_since?: number
    saudya_canada_since?: number
    salary_growth_rate?: number
  } = {}
) => {
  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
  ).toString()
  return api.post<ForecastSnapshot[]>(`/scenarios/${scenarioId}/run?${query}`).then(r => r.data)
}
