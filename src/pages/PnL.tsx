import { useMemo, useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { usePnL } from '../hooks/usePnL'
import type { Sale, DeliveryItem, OpexAllocation } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { formatUSD, formatPct } from '../lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PnLRow {
  deliveryId: string
  invoiceNumber: string | null
  supplierName: string
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  allocated_opex: number
  net_profit: number
  net_margin_pct: number
}

type PeriodType = 'month' | 'quarter' | 'year'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function quarterRange(yearQ: string): [string, string] {
  const [year, q] = yearQ.split('-Q')
  const qn = parseInt(q)
  const start = `${year}-${String((qn - 1) * 3 + 1).padStart(2, '0')}`
  const end = `${year}-${String(qn * 3).padStart(2, '0')}`
  return [start, end]
}

const QUARTER_OPTIONS = ['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q) =>
  [String(new Date().getFullYear()), String(new Date().getFullYear() - 1)].map((y) => ({
    value: `${y}-${q}`,
    label: `${q} ${y}`,
  })),
)

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = String(new Date().getFullYear() - i)
  return { value: y, label: y }
})

function profitColor(v: number) {
  return v > 0 ? 'text-green-700' : v < 0 ? 'text-red-600' : 'text-gray-600'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PnL() {
  const { deliveries, allItems, allSales, allAllocations, loading } = usePnL()

  useEffect(() => {
    document.title = 'P&L | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [selectedMonth, setSelectedMonth] = useState(currentYM)
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const q = Math.ceil((new Date().getMonth() + 1) / 3)
    return `${new Date().getFullYear()}-Q${q}`
  })
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()))

  const periodLabel =
    periodType === 'month' ? selectedMonth
    : periodType === 'quarter' ? selectedQuarter
    : selectedYear

  const filterSale = useCallback((s: Sale): boolean => {
    const d = s.sale_date
    if (periodType === 'month') return d.startsWith(selectedMonth)
    if (periodType === 'year') return d.startsWith(selectedYear)
    const [start, end] = quarterRange(selectedQuarter)
    return d >= start + '-01' && d <= end + '-31'
  }, [periodType, selectedMonth, selectedQuarter, selectedYear])

  const filterAlloc = useCallback((a: OpexAllocation): boolean => {
    const m = a.month
    if (periodType === 'month') return m === selectedMonth
    if (periodType === 'year') return m.startsWith(selectedYear)
    const [start, end] = quarterRange(selectedQuarter)
    return m >= start && m <= end
  }, [periodType, selectedMonth, selectedQuarter, selectedYear])

  const pnlRows: PnLRow[] = useMemo(() => {
    const itemMap = new Map<string, DeliveryItem>(allItems.map((i) => [i.id, i]))
    const itemDeliveryMap = new Map<string, string>(allItems.map((i) => [i.id, i.delivery_id]))

    const salesByDelivery = new Map<string, Sale[]>()
    for (const s of allSales) {
      if (!filterSale(s)) continue
      const deliveryId = itemDeliveryMap.get(s.delivery_item_id)
      if (!deliveryId) continue
      if (!salesByDelivery.has(deliveryId)) salesByDelivery.set(deliveryId, [])
      salesByDelivery.get(deliveryId)!.push(s)
    }

    const allocByDelivery = new Map<string, number>()
    for (const a of allAllocations) {
      if (!filterAlloc(a)) continue
      allocByDelivery.set(a.delivery_id, (allocByDelivery.get(a.delivery_id) ?? 0) + a.allocated_amount_usd)
    }

    return deliveries
      .map((delivery) => {
        const sup = (delivery as unknown as { supplier?: { name: string } }).supplier
        const sales = salesByDelivery.get(delivery.id) ?? []
        let revenue = 0
        let cogs = 0
        for (const s of sales) {
          revenue += s.total_real_usd ?? s.quantity * s.real_price_per_pack
          const item = itemMap.get(s.delivery_item_id)
          cogs += (item?.landed_cost_usd ?? 0) * s.quantity
        }
        const gross_profit = revenue - cogs
        const gross_margin_pct = revenue > 0 ? (gross_profit / revenue) * 100 : 0
        const allocated_opex = allocByDelivery.get(delivery.id) ?? 0
        const net_profit = gross_profit - allocated_opex
        const net_margin_pct = revenue > 0 ? (net_profit / revenue) * 100 : 0
        return {
          deliveryId: delivery.id,
          invoiceNumber: delivery.invoice_number,
          supplierName: sup?.name ?? '—',
          revenue, cogs, gross_profit, gross_margin_pct, allocated_opex, net_profit, net_margin_pct,
        }
      })
      .filter((r) => r.revenue > 0 || r.cogs > 0 || r.allocated_opex > 0)
  }, [deliveries, allItems, allSales, allAllocations, filterSale, filterAlloc])

  const totals = useMemo(() => ({
    revenue: pnlRows.reduce((s, r) => s + r.revenue, 0),
    cogs: pnlRows.reduce((s, r) => s + r.cogs, 0),
    gross_profit: pnlRows.reduce((s, r) => s + r.gross_profit, 0),
    allocated_opex: pnlRows.reduce((s, r) => s + r.allocated_opex, 0),
    net_profit: pnlRows.reduce((s, r) => s + r.net_profit, 0),
  }), [pnlRows])

  const handleExport = () => {
    const headers = [
      'Delivery', 'Supplier', 'Revenue (USD)', 'COGS (USD)',
      'Gross Profit', 'Gross Margin %', 'Allocated OpEx', 'Net Profit', 'Net Margin %',
    ]
    const rows = pnlRows.map((r) => [
      r.invoiceNumber ?? '—',
      r.supplierName,
      r.revenue, r.cogs, r.gross_profit,
      `${r.gross_margin_pct.toFixed(1)}%`,
      r.allocated_opex, r.net_profit,
      `${r.net_margin_pct.toFixed(1)}%`,
    ])
    const totalRow = [
      'TOTAL', '',
      totals.revenue, totals.cogs, totals.gross_profit,
      totals.revenue > 0 ? `${((totals.gross_profit / totals.revenue) * 100).toFixed(1)}%` : '—',
      totals.allocated_opex, totals.net_profit,
      totals.revenue > 0 ? `${((totals.net_profit / totals.revenue) * 100).toFixed(1)}%` : '—',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P&L')
    XLSX.writeFile(wb, `pnl-${periodLabel}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[{ label: 'P&L' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Profit & Loss</h1>
          <p className="text-sm text-gray-500 mt-0.5">Per-delivery P&L for the selected period.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={handleExport}
          disabled={pnlRows.length === 0}
        >
          Export to Excel
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white border border-gray-200 p-4">
        <div className="w-36">
          <Select
            label="Period"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'quarter', label: 'Quarter' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </div>
        {periodType === 'month' && (
          <div className="w-44">
            <Input label="Month" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>
        )}
        {periodType === 'quarter' && (
          <div className="w-44">
            <Select label="Quarter" value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)} options={QUARTER_OPTIONS} />
          </div>
        )}
        {periodType === 'year' && (
          <div className="w-32">
            <Select label="Year" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} options={YEAR_OPTIONS} />
          </div>
        )}
        {!loading && (
          <p className="text-sm text-gray-400 pb-2">
            {pnlRows.length} deliver{pnlRows.length !== 1 ? 'ies' : 'y'} with data
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : pnlRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No sales data for this period.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Delivery', 'Supplier', 'Revenue', 'COGS', 'Gross Profit', 'GM %', 'Alloc. OpEx', 'Net Profit', 'NM %'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pnlRows.map((row) => (
                <tr key={row.deliveryId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.invoiceNumber ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.supplierName}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatUSD(row.revenue)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatUSD(row.cogs)}</td>
                  <td className={`px-4 py-3 font-semibold ${profitColor(row.gross_profit)}`}>{formatUSD(row.gross_profit)}</td>
                  <td className={`px-4 py-3 font-medium ${profitColor(row.gross_margin_pct)}`}>{formatPct(row.gross_margin_pct)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatUSD(row.allocated_opex)}</td>
                  <td className={`px-4 py-3 font-semibold ${profitColor(row.net_profit)}`}>{formatUSD(row.net_profit)}</td>
                  <td className={`px-4 py-3 font-medium ${profitColor(row.net_margin_pct)}`}>{formatPct(row.net_margin_pct)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td colSpan={2} className="px-4 py-3 text-gray-900 text-sm">TOTAL</td>
                <td className="px-4 py-3 text-gray-900">{formatUSD(totals.revenue)}</td>
                <td className="px-4 py-3 text-gray-600">{formatUSD(totals.cogs)}</td>
                <td className={`px-4 py-3 ${profitColor(totals.gross_profit)}`}>{formatUSD(totals.gross_profit)}</td>
                <td className={`px-4 py-3 ${profitColor(totals.gross_profit)}`}>
                  {totals.revenue > 0 ? formatPct((totals.gross_profit / totals.revenue) * 100) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{formatUSD(totals.allocated_opex)}</td>
                <td className={`px-4 py-3 ${profitColor(totals.net_profit)}`}>{formatUSD(totals.net_profit)}</td>
                <td className={`px-4 py-3 ${profitColor(totals.net_profit)}`}>
                  {totals.revenue > 0 ? formatPct((totals.net_profit / totals.revenue) * 100) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
