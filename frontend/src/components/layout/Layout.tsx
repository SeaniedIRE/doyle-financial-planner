import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TaxYearBanner from '../ui/TaxYearBanner'

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
          <TaxYearBanner />
          <Outlet />
        </div>
      </main>
    </div>
  )
}
