import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { useARaging } from '../hooks/useARaging'
import type { AgingSale } from '../hooks/useARaging'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { formatUSD, formatDate } from '../lib/formatters'

function agingColor(days: number) {
  if (days <= 0) return 'text-gray-600'
  if (days <= 30) return 'text-yellow-700'
  if (days <= 60) return 'text-orange-600'
  return 'text-red-600 font-semibold'
}

function agingBg(days: number) {
  if (days <= 0) return ''
  if (days <= 30) return 'bg-yellow-50'
  if (days <= 60) return 'bg-orange-50'
  return 'bg-red-50'
}

export function ARaging() {
  const { sales, dealerRows, totals, loading } = useARaging()

  useEffect(() => {
    document.title = 'AR Aging | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [expandedDealers, setExpandedDealers] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpandedDealers((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const salesByDealer = new Map<string, AgingSale[]>()
  for (const s of sales) {
    if (!salesByDealer.has(s.dealer_id)) salesByDealer.set(s.dealer_id, [])
    salesByDealer.get(s.dealer_id)!.push(s)
  }

  const grandTotal = totals.total

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb items={[{ label: 'AR Aging' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Accounts Receivable Aging</h1>
        <p className="text-sm text-gray-500 mt-0.5">Outstanding balances by dealer — pending and partial payments only</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Current (not due)', value: totals.current, cls: 'text-gray-900' },
          { label: '1–30 days', value: totals.days_1_30, cls: 'text-yellow-700' },
          { label: '31–60 days', value: totals.days_31_60, cls: 'text-orange-600' },
          { label: '61–90 days', value: totals.days_61_90, cls: 'text-red-500' },
          { label: '90+ days', value: totals.days_90_plus, cls: 'text-red-700 font-bold' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`mt-1 text-lg font-bold ${cls}`}>{formatUSD(value)}</p>
            {grandTotal > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{((value / grandTotal) * 100).toFixed(0)}%</p>
            )}
          </div>
        ))}
      </div>

      {/* Alert for 90+ */}
      {totals.days_90_plus > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span className="text-red-700 font-medium">{formatUSD(totals.days_90_plus)}</span>
          <span className="text-red-600">is more than 90 days overdue — consider immediate follow-up.</span>
        </div>
      )}

      {/* Aging table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : dealerRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No outstanding receivables.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dealer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Current</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-700 uppercase tracking-wider">1–30d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-orange-600 uppercase tracking-wider">31–60d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wider">61–90d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase tracking-wider">90+d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {dealerRows.map((row) => (
                <>
                  <tr
                    key={row.dealer_id}
                    className={`cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${agingBg(row.oldest_days)}`}
                    onClick={() => toggle(row.dealer_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expandedDealers.has(row.dealer_id)
                          ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                          : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                        <span className="font-medium text-gray-900">{row.dealer_name}</span>
                        <span className="text-xs text-gray-400">({row.sale_count} sale{row.sale_count !== 1 ? 's' : ''})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.current > 0 ? formatUSD(row.current) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-yellow-700">{row.days_1_30 > 0 ? formatUSD(row.days_1_30) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{row.days_31_60 > 0 ? formatUSD(row.days_31_60) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-red-500">{row.days_61_90 > 0 ? formatUSD(row.days_61_90) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-red-700 font-semibold">{row.days_90_plus > 0 ? formatUSD(row.days_90_plus) : <span className="text-gray-300 font-normal">—</span>}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatUSD(row.total)}</td>
                  </tr>
                  {expandedDealers.has(row.dealer_id) && (
                    salesByDealer.get(row.dealer_id)?.map((s) => (
                      <tr key={s.id} className={`border-b border-gray-50 text-xs ${agingBg(s.days_outstanding)}`}>
                        <td className="pl-10 pr-4 py-2 text-gray-500">
                          {s.product_name ?? '—'} {s.invoice_ref ? `· ${s.invoice_ref}` : ''}
                          <span className="ml-2 text-gray-400">{formatDate(s.sale_date)}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500" colSpan={5}>
                          <span className={agingColor(s.days_outstanding)}>
                            {s.days_outstanding <= 0
                              ? `due ${s.payment_due_date ? formatDate(s.payment_due_date) : '—'}`
                              : `${s.days_outstanding}d overdue`}
                          </span>
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {s.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-700">{formatUSD(s.amount_usd)}</td>
                      </tr>
                    ))
                  )}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-sm">
                <td className="px-4 py-3 text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatUSD(totals.current)}</td>
                <td className="px-4 py-3 text-right text-yellow-700">{formatUSD(totals.days_1_30)}</td>
                <td className="px-4 py-3 text-right text-orange-600">{formatUSD(totals.days_31_60)}</td>
                <td className="px-4 py-3 text-right text-red-500">{formatUSD(totals.days_61_90)}</td>
                <td className="px-4 py-3 text-right text-red-700">{formatUSD(totals.days_90_plus)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatUSD(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
