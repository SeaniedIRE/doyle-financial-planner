export interface Account {
  id: number
  name: string
  account_type: string
  owner: 'sean' | 'saudya' | 'joint'
  account_number: string
  currency: string
  margin_loan_cad: number
  margin_rate_pct: number
  notes: string
  total_book_value_cad: number
  total_market_value_cad: number
  unrealized_gain_cad: number
  holdings_count: number
}

export interface Holding {
  id: number
  symbol: string
  exchange: string
  name: string
  security_type: string
  quantity: number
  book_value_cad: number
  current_price: number
  price_currency: string
  market_value_cad: number
  unrealized_gain_cad: number
  unrealized_pct: number
  acb_per_share: number
  last_updated: string | null
  notes: string
}

export interface ACBTransaction {
  id: number
  holding_id: number
  transaction_date: string
  date: string           // API may return either field name
  transaction_type: string
  quantity: number
  price_per_share_cad: number
  fees_cad: number
  fx_rate: number
  total_cost_cad: number
  shares_after: number
  acb_per_share_after: number
  total_acb_after: number
  capital_gain_loss_cad: number
  superficial_loss_flag: boolean
  notes: string
}

export interface Income {
  id: number
  person: string
  year: number
  employment_income: number
  bonus: number
  other_bonus: number
  investment_income: number
  rental_income: number
  other_income: number
  total_gross: number
  province: string
  is_maternity_leave: boolean
  maternity_ei_income: number
  notes: string
}

export interface TaxResult {
  gross_income: number
  taxable_income: number
  rrsp_deduction: number
  federal_tax: number
  provincial_tax: number
  total_tax: number
  average_rate_pct: number
  marginal_federal_pct: number
  marginal_provincial_pct: number
  combined_marginal_pct: number
  after_tax_income: number
  capital_gains_tax: number
  province: string
  year: number
  breakdown: Record<string, number>
  notes: string[]
}

export interface Scenario {
  id: number
  name: string
  description: string
  is_baseline: boolean
  growth_conservative_pct: number
  growth_moderate_pct: number
  growth_optimistic_pct: number
  house_purchase_year: number
  house_price_cad: number
  house_down_payment_cad: number
  assumptions: Record<string, unknown>
  created_at: string
}

export interface ForecastSnapshot {
  year: number
  sean_net_worth: { conservative: number; moderate: number; optimistic: number }
  saudya_net_worth: { conservative: number; moderate: number; optimistic: number }
  combined_net_worth: { conservative: number; moderate: number; optimistic: number }
  sean_income_after_tax: number
  saudya_income_after_tax: number
  sean_tax: number
  saudya_tax: number
  tfsa_sean: { conservative: number; moderate: number; optimistic: number }
  tfsa_saudya: { conservative: number; moderate: number; optimistic: number }
  rrsp_sean: { conservative: number; moderate: number; optimistic: number }
  rrsp_saudya: { conservative: number; moderate: number; optimistic: number }
  fhsa_sean: { conservative: number; moderate: number; optimistic: number }
  fhsa_saudya: { conservative: number; moderate: number; optimistic: number }
  margin_sean: { conservative: number; moderate: number; optimistic: number }
  margin_saudya: { conservative: number; moderate: number; optimistic: number }
  joint: { conservative: number; moderate: number; optimistic: number }
  events: string[]
}

export interface LossHarvestAnalysis {
  symbol: string
  holding_name: string
  account: string
  account_type: string
  unrealized_loss: number
  usable_against_ytd_gains: number
  loss_carryforward: number
  estimated_tax_saved_now: number
  estimated_tax_saved_carryforward: number
  superficial_loss_warning: string
  action: string
}

export type ScenarioKey = 'conservative' | 'moderate' | 'optimistic'
