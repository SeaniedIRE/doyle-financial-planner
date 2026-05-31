import api from './client'
import type { TaxResult, Income } from '../types'

export const calculateTax = (params: Record<string, unknown>) =>
  api.post<TaxResult>('/tax/calculate', params).then(r => r.data)

export const getTaxComparison = (year: number) =>
  api.get(`/tax/comparison/${year}`).then(r => r.data)

export const getContributionRoom = (person: string, year: number, canadaSince = 2018) =>
  api.get(`/tax/contribution-room/${person}/${year}?canada_since=${canadaSince}`).then(r => r.data)

export const getMaternityEI = (year: number, earnings: number, weeks?: number) =>
  api.get(`/tax/maternity-ei/${year}?insurable_earnings=${earnings}${weeks !== undefined ? `&weeks=${weeks}` : ''}`).then(r => r.data)

export const getIncome = (person?: string) =>
  person
    ? api.get<Income[]>(`/income/${person}`).then(r => r.data)
    : api.get<Income[]>('/income/').then(r => r.data)

export const createIncome = (data: Partial<Income>) => api.post('/income/', data).then(r => r.data)
export const updateIncome = (id: number, data: Partial<Income>) => api.put(`/income/${id}`, data).then(r => r.data)
export const deleteIncome = (id: number) => api.delete(`/income/${id}`)
