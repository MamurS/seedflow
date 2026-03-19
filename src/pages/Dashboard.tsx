import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Card } from '../components/ui/Card'
import { DollarSign, TrendingUp, Package, AlertCircle } from 'lucide-react'

export function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          title="Total Revenue"
          value="—"
          subtitle="All time"
          icon={<DollarSign size={20} />}
        />
        <Card
          title="Gross Profit"
          value="—"
          subtitle="All time"
          icon={<TrendingUp size={20} />}
          variant="success"
        />
        <Card
          title="Net Profit"
          value="—"
          subtitle="After OpEx"
          icon={<TrendingUp size={20} />}
          variant="success"
        />
        <Card
          title="Outstanding Receivables"
          value="—"
          subtitle="Unpaid invoices"
          icon={<AlertCircle size={20} />}
          variant="warning"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package size={16} className="text-gray-500" />
            Active Deliveries Pipeline
          </h2>
          <p className="text-sm text-gray-400">No active deliveries yet.</p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-gray-500" />
            Overdue Payments
          </h2>
          <p className="text-sm text-gray-400">No overdue payments.</p>
        </div>
      </div>
    </div>
  )
}
