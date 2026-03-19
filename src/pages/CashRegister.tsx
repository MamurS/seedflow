import { useState, useEffect } from 'react'
import { Pencil, Trash2, Receipt } from 'lucide-react'
import { useCashRegister } from '../hooks/useCashRegister'
import type { CashRegisterRow, DeliveryItemCashStatus } from '../hooks/useCashRegister'
import type { CashRegisterInsert } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDate, formatUZS, formatNumber } from '../lib/formatters'

const today = new Date().toISOString().split('T')[0]

interface RegisterForm {
  register_date: string
  packs_registered: string
  amount_uzs: string
  receipt_number: string
  notes: string
}

const EMPTY_FORM: RegisterForm = {
  register_date: today,
  packs_registered: '',
  amount_uzs: '',
  receipt_number: '',
  notes: '',
}

export function CashRegister() {
  const { entries, itemStatuses, loading, totals, create, remove } = useCashRegister()

  useEffect(() => {
    document.title = 'Cash Register | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<DeliveryItemCashStatus | null>(null)
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CashRegisterRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const setField = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Auto-calculate amount when packs change
  const handlePacksChange = (val: string) => {
    setField('packs_registered', val)
    if (selectedItem?.official_price_uzs && val) {
      const packs = Number(val)
      if (!isNaN(packs) && packs > 0) {
        setField('amount_uzs', String(packs * selectedItem.official_price_uzs))
      }
    }
  }

  const openRegister = (item: DeliveryItemCashStatus) => {
    setSelectedItem(item)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.register_date) e.register_date = 'Date is required'
    const packs = Number(form.packs_registered)
    if (!form.packs_registered || isNaN(packs) || packs <= 0) {
      e.packs_registered = 'Packs must be > 0'
    } else if (selectedItem && packs > selectedItem.remaining_packs) {
      e.packs_registered = `Max ${selectedItem.remaining_packs} remaining`
    }
    if (!form.amount_uzs || Number(form.amount_uzs) <= 0) e.amount_uzs = 'Amount must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate() || !selectedItem) return
    setSaving(true)
    const payload: CashRegisterInsert = {
      delivery_item_id: selectedItem.delivery_item_id,
      register_date: form.register_date,
      packs_registered: Number(form.packs_registered),
      amount_uzs: Number(form.amount_uzs),
      receipt_number: form.receipt_number.trim() || null,
      notes: form.notes.trim() || null,
    }
    const ok = await create(payload)
    setSaving(false)
    if (ok) setPanelOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const remainingPacks = selectedItem
    ? selectedItem.remaining_packs - (Number(form.packs_registered) || 0)
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[{ label: 'Cash Register' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Cash Register</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track official price registrations through the cash register (кассовый аппарат)</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Registered Packs', value: formatNumber(totals.totalRegistered, 0), sub: 'packs registered' },
          { label: 'Total Registered (UZS)', value: formatUZS(totals.totalRegisteredUZS), sub: 'at official prices' },
          {
            label: 'Remaining Packs',
            value: formatNumber(totals.totalRemaining, 0),
            sub: 'not yet registered',
            warn: totals.totalRemaining > 0,
          },
          {
            label: 'Remaining Value (UZS)',
            value: formatUZS(totals.totalRemainingUZS),
            sub: 'to register',
            warn: totals.totalRemainingUZS > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={[
              'rounded-lg border p-4',
              card.warn ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200',
            ].join(' ')}
          >
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            <p className={['text-lg font-semibold mt-1', card.warn ? 'text-yellow-700' : 'text-gray-900'].join(' ')}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Main inventory table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery Items — Registration Status</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : itemStatuses.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No delivery items found.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Product', 'Delivery', 'Total Packs', 'Official Price (UZS)', 'Total Value (UZS)', 'Registered', 'Reg. Amount', 'Remaining', 'Rem. Amount (UZS)', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemStatuses.map((row) => {
                  const isFullyRegistered = row.remaining_packs === 0 && row.total_registered_packs > 0
                  const isPartial = row.total_registered_packs > 0 && row.remaining_packs > 0
                  const isNone = row.total_registered_packs === 0
                  const rowClass = isFullyRegistered
                    ? 'bg-green-50'
                    : isPartial
                      ? 'bg-yellow-50'
                      : isNone && row.sellable_qty > 0
                        ? 'bg-red-50'
                        : ''
                  const totalValue = (row.official_price_uzs ?? 0) * row.sellable_qty

                  return (
                    <tr key={row.delivery_item_id} className={rowClass}>
                      <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{row.product_name}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{row.invoice_number ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-gray-900">{formatNumber(row.sellable_qty, 0)}</td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {row.official_price_uzs ? formatUZS(row.official_price_uzs) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{totalValue > 0 ? formatUZS(totalValue) : '—'}</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{formatNumber(row.total_registered_packs, 0)}</td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {row.registered_amount_uzs > 0 ? formatUZS(row.registered_amount_uzs) : '—'}
                      </td>
                      <td className={['px-3 py-3 text-right font-semibold',
                        isFullyRegistered ? 'text-green-700' : isPartial ? 'text-yellow-700' : 'text-red-600'
                      ].join(' ')}>
                        {formatNumber(row.remaining_packs, 0)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {row.remaining_amount_uzs > 0 ? formatUZS(row.remaining_amount_uzs) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={[
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          isFullyRegistered
                            ? 'bg-green-100 text-green-800'
                            : isPartial
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800',
                        ].join(' ')}>
                          {isFullyRegistered ? 'Complete' : isPartial ? 'Partial' : 'None'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.remaining_packs > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Receipt size={14} />}
                            onClick={() => openRegister(row)}
                          >
                            Register
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Registration History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Registration History</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No registrations yet.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Date', 'Product', 'Delivery', 'Packs', 'Amount (UZS)', 'Receipt #', 'Notes', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{formatDate(entry.register_date)}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{entry.delivery_item?.product?.name ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{entry.delivery_item?.delivery?.invoice_number ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-medium">{formatNumber(entry.packs_registered, 0)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatUZS(entry.amount_uzs)}</td>
                    <td className="px-3 py-3 text-gray-500">{entry.receipt_number ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs max-w-[120px] truncate">{entry.notes ?? '—'}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Register SidePanel */}
      <SidePanel
        open={panelOpen}
        title={`Register: ${selectedItem?.product_name ?? ''}`}
        onClose={() => setPanelOpen(false)}
      >
        {selectedItem && (
          <div className="flex flex-col gap-4">
            {/* Item summary */}
            <div className="rounded-md bg-blue-50 border border-blue-100 px-4 py-3 text-sm flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="font-medium">{selectedItem.invoice_number ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sellable Qty</span>
                <span className="font-medium">{formatNumber(selectedItem.sellable_qty, 0)} packs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already Registered</span>
                <span className="font-medium">{formatNumber(selectedItem.total_registered_packs, 0)} packs</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                <span className="text-gray-600 font-medium">Remaining</span>
                <span className="font-bold text-blue-700">{formatNumber(selectedItem.remaining_packs, 0)} packs</span>
              </div>
              {selectedItem.official_price_uzs && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Official Price</span>
                  <span className="font-medium">{formatUZS(selectedItem.official_price_uzs)} / pack</span>
                </div>
              )}
            </div>

            <Input
              label="Registration Date"
              type="date"
              value={form.register_date}
              onChange={(e) => setField('register_date', e.target.value)}
              error={errors.register_date}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Packs to Register (max ${selectedItem.remaining_packs})`}
                type="number"
                value={form.packs_registered}
                onChange={(e) => handlePacksChange(e.target.value)}
                error={errors.packs_registered}
                required
              />
              <Input
                label="Amount (UZS)"
                type="number"
                value={form.amount_uzs}
                onChange={(e) => setField('amount_uzs', e.target.value)}
                error={errors.amount_uzs}
                required
                hint="Auto-calculated from official price"
              />
            </div>

            {/* After-registration preview */}
            {form.packs_registered && Number(form.packs_registered) > 0 && (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-500">After registration, remaining:</span>
                <span className={['font-semibold', remainingPacks === 0 ? 'text-green-700' : 'text-yellow-700'].join(' ')}>
                  {Math.max(0, remainingPacks)} packs
                </span>
              </div>
            )}

            <Input
              label="Receipt Number"
              value={form.receipt_number}
              onChange={(e) => setField('receipt_number', e.target.value)}
              placeholder="Optional"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
              <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={<Pencil size={14} />}>
                Record Registration
              </Button>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Registration"
        message="Delete this cash register entry? The remaining packs will be restored."
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
