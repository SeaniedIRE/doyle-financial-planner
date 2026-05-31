import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Holdings from './pages/Holdings'
import ACBTracker from './pages/ACBTracker'
import TaxPlanning from './pages/TaxPlanning'
import Income from './pages/Income'
import Scenarios from './pages/Scenarios'
import Forecasts from './pages/Forecasts'
import HousePlanning from './pages/HousePlanning'
import MaternityPlanning from './pages/MaternityPlanning'
import AIAdvisor from './pages/AIAdvisor'
import Settings from './pages/Settings'
import WhatIf from './pages/WhatIf'
import TrustAccounts from './pages/TrustAccounts'
import FamilyMembers from './pages/FamilyMembers'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="holdings" element={<Holdings />} />
          <Route path="acb" element={<ACBTracker />} />
          <Route path="tax" element={<TaxPlanning />} />
          <Route path="income" element={<Income />} />
          <Route path="scenarios" element={<Scenarios />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="house" element={<HousePlanning />} />
          <Route path="maternity" element={<MaternityPlanning />} />
          <Route path="whatif" element={<WhatIf />} />
          <Route path="trusts" element={<TrustAccounts />} />
          <Route path="family" element={<FamilyMembers />} />
          <Route path="ai" element={<AIAdvisor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
