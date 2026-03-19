import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, RefreshCw, Loader2 } from 'lucide-react'
import { useOpEx, addMonths, currentYM, monthLabel } from '../hooks/useOpEx'
import { useDeliveries } from '../hooks/useDeliveries'
import type { OpexCategory } from '../types/database'
import { OPEX_CATEGORIES } from '../lib/constants'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { formatUSD, formatPct } from '../lib/formatters'

// ─── Inline-editable cell ─────────────────────────────────────────────────────

interface EditableCellProps {
  value: number | null
  onSave: (v: number | null) => void
}

function EditableCell({ value, onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setInputVal(value != null ? String(value) : '')
    setEditing(true)
  }

  useEffect(() => {
    if (editing) ref.current?.select()
  }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    const trimmed = inputVal.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    const newVal = parsed != null && !isNaN(parsed) ? parsed : null
    if (newVal !== value) onSave(newVal)
  }, [inputVal, value, onSave])

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="w-full min-w-[90px] rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className="min-w-[90px] cursor-text rounded px-2 py-1 text-right text-sm hover:bg-blue-50 transition-colors"
      title="Click to edit"
    >
      {value != null ? (
        <span className="text-gray-900">{value.toLocaleString('en-US')}</span>
      ) : (
        <span className="text-gray-300">—</span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OpEx() {
  const {
    entries, allocations, loading,
    upsertEntry, setMonthExchangeRate, copyPreviousMonth, recalculateAllocations,
  } = useOpEx()
  const { deliveries } = useDeliveries()

  const [startMonth, setStartMonth] = useState(() => addMonths(currentYM(), -5))
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)

  // Exchange rate local state per month
  const [monthRates, setMonthRates] = useState<Record<string, string>>({})
  useEffect(() => {
    setMonthRates((prev) => {
      const next = { ...prev }
      for (const e of entries) {
        if (e.exchange_rate != null && !next[e.month]) {
          next[e.month] = String(e.exchange_rate)
        }
      }
      return next
    })
  }, [entries])

  const visibleMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(startMonth, i)),
    [startMonth],
  )

  const entryMap = useMemo(() => {
    const m = new Map<string, { amount_uzs: number | null; exchange_rate: number | null }>()
    for (const e of entries) m.set(`${e.month}|${e.category}`, e)
    return m
  }, [entries])

  const getRate = (month: string): number | null => {
    const v = monthRates[month]
    if (!v || !v.trim()) return null
    const n = Number(v)
    return isNaN(n) || n <= 0 ? null : n
  }

  const handleRateBlur = async (month: string) => {
    const rate = getRate(month)
    if (rate != null) await setMonthExchangeRate(month, rate)
  }

  const handleCopyPrevious = async () => {
    setCopyLoading(true)
    await copyPreviousMonth(currentYM())
    setCopyLoading(false)
  }

  const handleRecalculate = async () => {
    setRecalcLoading(true)
    await recalculateAllocations(deliveries)
    setRecalcLoading(false)
  }

  const colTotalUzs = (month: string) =>
    OPEX_CATEGORIES.reduce((s, c) => s + (entryMap.get(`${month}|${c.value}`)?.amount_uzs ?? 0), 0)

  const colTotalUsd = (month: string) => {
    const rate = getRate(month)
    const uzs = colTotalUzs(month)
    return rate && rate > 0 ? uzs / rate : null
  }

  const rowTotal = (cat: OpexCategory) =>
    visibleMonths.reduce((s, m) => s + (entryMap.get(`${m}|${cat}`)?.amount_uzs ?? 0), 0)

  const grandTotalUzs = visibleMonths.reduce((s, m) => s + colTotalUzs(m), 0)

  // Aggregate allocations by (delivery, month) for display
  const allocationRows = useMemo(() => {
    const map = new Map<string, {
      month: string; alloc_pct: number; allocated_usd: number; deliveryLabel: string; cip: number | null
    }>()
    for (const a of allocations) {
      const key = `${a.month}|${a.delivery_id}`
      if (!map.has(key)) {
        const d = (a as unknown as {
          delivery?: { invoice_number?: string | null; total_cip_usd?: number | null; supplier?: { name: string } }
        }).delivery
        const label = d
          ? `${d.supplier?.name ?? '—'} · INV ${d.invoice_number ?? '—'}`
          : a.delivery_id
        map.set(key, { month: a.month, alloc_pct: a.allocation_pct, allocated_usd: 0, deliveryLabel: label, cip: d?.total_cip_usd ?? null })
      }
      map.get(key)!.allocated_usd += a.allocated_amount_usd
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [allocations])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[{ label: 'OpEx' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Operating Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Click any cell to edit. Amounts in UZS.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={14} />}
          onClick={handleCopyPrevious}
          loading={copyLoading}
        >
          Copy Previous Month to Current
        </Button>
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setStartMonth((s) => addMonths(s, -1))}
            className="rounded p-1 hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {monthLabel(visibleMonths[0])} – {monthLabel(visibleMonths[5])}
          </span>
          <button
            onClick={() => setStartMonth((s) => addMonths(s, 1))}
            className="rounded p-1 hover:bg-gray-200 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[160px]">
                  Category
                </th>
                {visibleMonths.map((m) => (
                  <th key={m} className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[110px]">
                  Total (UZS)
                </th>
              </tr>
              {/* Exchange Rate row */}
              <tr className="border-b border-dashed border-gray-200 bg-amber-50">
                <td className="sticky left-0 z-10 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                  Exch. Rate (UZS / $)
                </td>
                {visibleMonths.map((m) => (
                  <td key={m} className="px-2 py-1">
                    <input
                      type="number"
                      value={monthRates[m] ?? ''}
                      onChange={(e) => setMonthRates((r) => ({ ...r, [m]: e.target.value }))}
                      onBlur={() => handleRateBlur(m)}
                      placeholder="e.g. 12750"
                      className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </td>
                ))}
                <td />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {OPEX_CATEGORIES.map((cat) => (
                <tr key={cat.value} className="hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-gray-800 group-hover:bg-gray-50">
                    {cat.label}
                  </td>
                  {visibleMonths.map((m) => {
                    const cell = entryMap.get(`${m}|${cat.value}`)
                    return (
                      <td key={m} className="px-2 py-1">
                        <EditableCell
                          value={cell?.amount_uzs ?? null}
                          onSave={(v) => upsertEntry(m, cat.value as OpexCategory, v, getRate(m))}
                        />
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-medium text-gray-700">
                    {rowTotal(cat.value as OpexCategory) > 0
                      ? rowTotal(cat.value as OpexCategory).toLocaleString('en-US')
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-sm text-gray-900">
                  Total (UZS)
                </td>
                {visibleMonths.map((m) => (
                  <td key={m} className="px-2 py-3 text-right text-sm text-gray-900">
                    {colTotalUzs(m) > 0 ? colTotalUzs(m).toLocaleString('en-US') : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {grandTotalUzs > 0 ? grandTotalUzs.toLocaleString('en-US') : '—'}
                </td>
              </tr>
              <tr className="bg-blue-50 font-semibold">
                <td className="sticky left-0 z-10 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Total (USD)
                </td>
                {visibleMonths.map((m) => {
                  const usd = colTotalUsd(m)
                  return (
                    <td key={m} className="px-2 py-3 text-right text-sm text-blue-800">
                      {usd != null ? formatUSD(usd) : <span className="text-blue-300 font-normal text-xs">set rate</span>}
                    </td>
                  )
                })}
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Allocation section */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">OpEx Allocation</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Distributed to active deliveries by CIP weight.
              Requires exchange rates set in grid above.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleRecalculate}
            loading={recalcLoading}
          >
            Recalculate Allocations
          </Button>
        </div>

        {allocationRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No allocations yet. Set exchange rates and click "Recalculate Allocations".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Month', 'Delivery / Supplier', 'CIP (USD)', 'Alloc %', 'Allocated (USD)'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocationRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3 text-gray-700">{row.deliveryLabel}</td>
                    <td className="px-4 py-3 text-gray-700">{row.cip != null ? formatUSD(row.cip) : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{formatPct(row.alloc_pct)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatUSD(row.allocated_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
