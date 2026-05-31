import api from './client'
import type { Account, Holding } from '../types'

export const getAccounts = () => api.get<Account[]>('/accounts/').then(r => r.data)
export const getHoldings = (accountId: number) => api.get<Holding[]>(`/accounts/${accountId}/holdings`).then(r => r.data)
export const getPortfolioTotals = () => api.get('/accounts/summary/totals').then(r => r.data)
export const createAccount = (data: Partial<Account>) => api.post('/accounts/', data)
export const updateAccount = (id: number, data: Partial<Account>) => api.put(`/accounts/${id}`, data)
export const deleteAccount = (id: number) => api.delete(`/accounts/${id}`)
export const createHolding = (data: Partial<Holding>) => api.post('/accounts/holdings', data)
export const updateHolding = (id: number, data: Partial<Holding>) => api.put(`/accounts/holdings/${id}`, data)
export const deleteHolding = (id: number) => api.delete(`/accounts/holdings/${id}`)
export const getSettings = () => api.get<Record<string, string>>('/accounts/settings').then(r => r.data)
export const updateSettings = (data: Record<string, string>) => api.put('/accounts/settings', data)
