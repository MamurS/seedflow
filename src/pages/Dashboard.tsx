import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Package, Plus, ArrowRight } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { formatUSD, formatDate } from '../lib/formatters'
import { DELIVERY_STATUS_COLORS } from '../lib/constants'

function PipelineBox({ status, label, count }: { status: string; label: string; count: number }) {
  const cls = DELIVERY_STATUS_COLORS[status as keyof typeof DELIVERY_STATUS_COLORS] ?? 'bg-gray-100 text-gray-700'
  return (
    <div className={`rounded-lg px-3 py-2 text-center min-w-[80px] ${cls}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium mt-0.5 leading-tight">{label}</div>
    </div>
  )
}

export function Dashboard() {
  useEffect(() => {
    document.title = 'Dashboard | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const navigate = useNavigate()
  const { loading, kpis, pipeline, overduePayments, inventorySummary } = useDashboard()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Year-to-date metrics for {new Date().getFullYear()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/deliveries')}>
            New Delivery
          </Button>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/sales')}>
            New Sale
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => navigate('/inkasso')}>
            Record Inkasso
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          title="Total Revenue YTD"
          value={loading ? '…' : formatUSD(kpis.revenueYTD)}
          subtitle="From all sales this year"
          icon={<DollarSign size={20} />}
        />
        <Card
          title="Gross Profit YTD"
          value={loading ? '…' : formatUSD(kpis.grossProfitYTD)}
          subtitle="Revenue minus COGS"
          icon={kpis.grossProfitYTD >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          variant={kpis.grossProfitYTD >= 0 ? 'success' : 'danger'}
        />
        <Card
          title="Net Profit YTD"
          value={loading ? '…' : formatUSD(kpis.netProfitYTD)}
          subtitle="After allocated OpEx"
          icon={kpis.netProfitYTD >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          variant={kpis.netProfitYTD >= 0 ? 'success' : 'danger'}
        />
        <Card
          title="Outstanding Receivables"
          value={loading ? '…' : formatUSD(kpis.outstanding)}
          subtitle="Unpaid & partial sales"
          icon={<AlertCircle size={20} />}
          variant={kpis.outstanding > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Pipeline */}
      <div className="rounded-lg bg-white border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package size={16} className="text-gray-500" />
            Active Deliveries Pipeline
          </h2>
          <button
            onClick={() => navigate('/deliveries')}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {pipeline.map((stage, i) => (
              <div key={stage.status} className="flex items-center gap-2">
                <PipelineBox status={stage.status} label={stage.label} count={stage.count} />
                {i < pipeline.length - 1 && <ArrowRight size={14} className="text-gray-300 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Overdue payments */}
        <div className="rounded-lg bg-white border border-gray-200 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              Overdue Payments
              {overduePayments.length > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5">
                  {overduePayments.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : overduePayments.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue payments. </p>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Dealer', 'Product', 'Amount', 'Overdue'].map((h) => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overduePayments.slice(0, 8).map((s) => {
                    type EnrichedSale = typeof s & {
                      dealer?: { name: string }
                      delivery_item?: { product?: { name: string } }
                    }
                    const es = s as EnrichedSale
                    return (
                      <tr key={s.id} className="hover:bg-red-50 transition-colors">
                        <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">
                          {es.dealer?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                          {es.delivery_item?.product?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                          {formatUSD(s.total_real_usd ?? s.quantity * s.real_price_per_pack)}
                        </td>
                        <td className="py-2 text-red-600 font-semibold whitespace-nowrap">
                          {s.daysOverdue}d
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            (due {formatDate(s.payment_due_date)})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {overduePayments.length > 8 && (
                <p className="text-xs text-gray-400">
                  +{overduePayments.length - 8} more —{' '}
                  <button onClick={() => navigate('/sales')} className="text-blue-600 underline">view all</button>
                </p>
              )}
            </>
          )}
        </div>

        {/* Inventory summary */}
        <div className="rounded-lg bg-white border border-gray-200 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package size={16} className="text-gray-500" />
              Inventory Summary
              <span className="text-xs font-normal text-gray-400">(lowest stock first)</span>
            </h2>
            <button
              onClick={() => navigate('/deliveries')}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View deliveries <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : inventorySummary.length === 0 ? (
            <p className="text-sm text-gray-400">No inventory data yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Product', 'Invoice', 'Sold', 'Sellable', 'Remaining'].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventorySummary.map((row) => {
                  const isEmpty = row.remaining === 0
                  const isLow = !isEmpty && row.remaining < row.sellable * 0.2
                  type ItemWithJoins = typeof row.item & {
                    product?: { name: string }
                    delivery?: { invoice_number?: string | null }
                  }
                  const item = row.item as ItemWithJoins
                  return (
                    <tr key={item.id} className={isEmpty ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}>
                      <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">
                        {item.product?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 text-xs whitespace-nowrap">
                        {item.delivery?.invoice_number ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{row.sold}</td>
                      <td className="py-2 pr-3 text-gray-600">{row.sellable}</td>
                      <td className={`py-2 font-semibold whitespace-nowrap ${isEmpty ? 'text-red-600' : isLow ? 'text-yellow-700' : 'text-green-700'}`}>
                        {row.remaining}
                        {isEmpty && <span className="ml-1 text-xs font-normal">sold out</span>}
                        {isLow && <span className="ml-1 text-xs font-normal text-yellow-600">low</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
