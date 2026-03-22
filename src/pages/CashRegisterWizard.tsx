import { useState, useEffect } from 'react'
import { Wand2, RefreshCw, CheckCircle2, XCircle, Settings2, ChevronDown, ChevronUp, TrendingDown, Package } from 'lucide-react'
import { useCashRegisterWizard } from '../hooks/useCashRegisterWizard'
import type { WizardSettings } from '../hooks/useCashRegisterWizard'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { formatUZS } from '../lib/formatters'

export function CashRegisterWizard() {
  const {
    items,
    loading,
    settings,
    updateSettings,
    currentReceipt,
    sessionReceipts,
    sessionTotal,
    remainingBudget,
    confirming,
    closingSession,
    generateReceipt,
    confirmReceipt,
    regenerateReceipt,
    closeSession,
  } = useCashRegisterWizard()

  useEffect(() => {
    document.title = 'CR Wizard | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [showSettings, setShowSettings] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<WizardSettings>(settings)

  const handleSaveSettings = () => {
    updateSettings(settingsDraft)
    setShowSettings(false)
  }

  const hasInventory = items.some((i) => i.remaining_packs > 0)
  const budgetPct = Math.min(100, (sessionTotal / settings.daily_limit_uzs) * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Cash Register Wizard' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Wand2 size={20} className="text-[#1a56db]" />
            Cash Register Wizard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate receipts within daily and per-receipt limits</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSettingsDraft(settings); setShowSettings((v) => !v) }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <Settings2 size={15} />
            Settings
            {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {sessionReceipts.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={closeSession}
              loading={closingSession}
            >
              Close Session ({sessionReceipts.length})
            </Button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Wizard Settings</h3>
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                { key: 'daily_limit_uzs', label: 'Daily Limit (UZS)' },
                { key: 'max_receipt_uzs', label: 'Max per Receipt (UZS)' },
                { key: 'min_receipt_uzs', label: 'Min per Receipt (UZS)' },
              ] as { key: keyof WizardSettings; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-blue-800">{label}</label>
                <input
                  type="number"
                  value={settingsDraft[key]}
                  onChange={(e) => setSettingsDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setShowSettings(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
            <Button variant="primary" size="sm" onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </div>
      )}

      {/* Budget progress bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Daily Budget</span>
          <span className="text-sm text-gray-500">
            {formatUZS(sessionTotal)} used of {formatUZS(settings.daily_limit_uzs)}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={[
              'h-full rounded-full transition-all duration-500',
              budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-yellow-400' : 'bg-[#1a56db]',
            ].join(' ')}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">{budgetPct.toFixed(1)}% used</span>
          <span className="text-xs font-medium text-gray-600">
            {formatUZS(remainingBudget)} remaining
          </span>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-3 gap-6 items-start">

        {/* Left 2/3: Current receipt */}
        <div className="col-span-2 flex flex-col gap-4">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 flex items-center justify-center">
              <div className="text-sm text-gray-400">Loading inventory…</div>
            </div>
          ) : !hasInventory ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 flex flex-col items-center gap-3 text-center">
              <Package size={36} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No inventory available</p>
              <p className="text-xs text-gray-400">All items have been fully registered or have no official price set.</p>
            </div>
          ) : remainingBudget < settings.min_receipt_uzs ? (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-10 flex flex-col items-center gap-2 text-center">
              <TrendingDown size={32} className="text-yellow-500" />
              <p className="text-sm font-semibold text-yellow-800">Daily budget exhausted</p>
              <p className="text-xs text-yellow-600">Remaining {formatUZS(remainingBudget)} is below minimum receipt size.</p>
              {sessionReceipts.length > 0 && (
                <Button variant="danger" size="sm" onClick={closeSession} loading={closingSession} className="mt-2">
                  Close Session
                </Button>
              )}
            </div>
          ) : currentReceipt ? (
            /* Receipt card */
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receipt</span>
                  <span className="ml-2 text-sm font-mono font-semibold text-gray-800">{currentReceipt.receipt_number}</span>
                </div>
                <span className="text-xs text-gray-400">{currentReceipt.lines.length} line{currentReceipt.lines.length !== 1 ? 's' : ''}</span>
              </div>

              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Price/Pack</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentReceipt.lines.map((line, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{line.item.product_name}</div>
                        <div className="text-xs text-gray-400">
                          {[line.item.variety, line.item.invoice_number].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 whitespace-nowrap">
                        {formatUZS(line.item.official_price_uzs)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {line.qty.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatUZS(line.line_total_uzs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-700 text-right">Total</td>
                    <td className="px-5 py-3 text-right text-base font-bold text-gray-900 whitespace-nowrap">
                      {formatUZS(currentReceipt.total_uzs)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={regenerateReceipt}
                  disabled={confirming}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={14} />
                  Regenerate
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 size={15} />}
                  onClick={confirmReceipt}
                  loading={confirming}
                >
                  Entered in Register
                </Button>
              </div>
            </div>
          ) : (
            /* No current receipt — show generate prompt */
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Wand2 size={24} className="text-[#1a56db]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Ready to generate</p>
                <p className="text-xs text-gray-400 mt-1">
                  {sessionReceipts.length > 0
                    ? `${sessionReceipts.length} receipt${sessionReceipts.length !== 1 ? 's' : ''} confirmed so far`
                    : 'Start a new session by generating the first receipt'}
                </p>
              </div>
              <Button variant="primary" size="md" icon={<Wand2 size={16} />} onClick={generateReceipt}>
                Generate Receipt
              </Button>
            </div>
          )}

          {/* Session receipt log */}
          {sessionReceipts.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-semibold text-gray-700">Session Log</span>
                <span className="ml-2 text-xs text-gray-400">{sessionReceipts.length} confirmed</span>
              </div>
              <div className="divide-y divide-gray-50">
                {sessionReceipts.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-sm font-mono text-gray-700">{r.receipt_number}</span>
                      <span className="text-xs text-gray-400">{r.lines.length} line{r.lines.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatUZS(r.total_uzs)}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Total</span>
                <span className="text-base font-bold text-gray-900">{formatUZS(sessionTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 1/3: Inventory sidebar */}
        <div className="flex flex-col gap-4">
          {/* Session summary card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Session Summary</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Receipts</span>
                <span className="text-sm font-semibold text-gray-900">{sessionReceipts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-sm font-semibold text-gray-900">{formatUZS(sessionTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Remaining</span>
                <span className={['text-sm font-semibold', remainingBudget < settings.min_receipt_uzs ? 'text-red-600' : 'text-emerald-600'].join(' ')}>
                  {formatUZS(remainingBudget)}
                </span>
              </div>
            </div>
            {sessionReceipts.length > 0 && currentReceipt === null && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                <Button variant="primary" size="sm" icon={<Wand2 size={14} />} onClick={generateReceipt} className="w-full">
                  Next Receipt
                </Button>
                <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={closeSession} loading={closingSession} className="w-full">
                  Close Session
                </Button>
              </div>
            )}
          </div>

          {/* Inventory status */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory</h3>
            </div>
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No items with official prices</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                {items.map((item) => {
                  const pct = item.sellable_qty > 0 ? item.remaining_packs / item.sellable_qty : 0
                  const color = item.remaining_packs === 0
                    ? 'bg-gray-300'
                    : pct < 0.25
                    ? 'bg-red-400'
                    : pct < 0.6
                    ? 'bg-yellow-400'
                    : 'bg-emerald-400'
                  return (
                    <div key={item.delivery_item_id} className="px-4 py-2.5 flex items-center gap-2.5">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate font-medium">{item.product_name}</div>
                        {(item.variety || item.invoice_number) && (
                          <div className="text-xs text-gray-400 truncate">
                            {[item.variety, item.invoice_number].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={['text-sm font-semibold', item.remaining_packs === 0 ? 'text-gray-400' : 'text-gray-900'].join(' ')}>
                          {item.remaining_packs}
                        </div>
                        <div className="text-xs text-gray-400">of {item.sellable_qty}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
