import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useExchangeRates } from '../hooks/useExchangeRates'
import type { ExchangeRate } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDate, formatNumber } from '../lib/formatters'

export function ExchangeRates() {
  const { rates, loading, create, remove } = useExchangeRates()

  useEffect(() => {
    document.title = 'Exchange Rates | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [form, setForm] = useState({ date: '', usd_uzs: '' })
  const [errors, setErrors] = useState<{ date?: string; usd_uzs?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExchangeRate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const validate = () => {
    const e: typeof errors = {}
    if (!form.date) e.date = 'Date is required'
    if (!form.usd_uzs || Number(form.usd_uzs) <= 0) e.usd_uzs = 'Enter a valid rate'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const ok = await create({ date: form.date, usd_uzs: Number(form.usd_uzs), source: 'cbu' })
    setSaving(false)
    if (ok) { setPanelOpen(false); setForm({ date: '', usd_uzs: '' }) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  // Latest rate for display
  const latestRate = rates[0]

  const columns: Column<ExchangeRate>[] = [
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    {
      key: 'usd_uzs',
      label: '1 USD = UZS',
      sortable: true,
      render: (r) => <span className="font-medium">{formatNumber(r.usd_uzs, 0)} UZS</span>,
    },
    { key: 'source', label: 'Source', render: (r) => r.source.toUpperCase() },
    { key: 'created_at', label: 'Recorded', render: (r) => formatDate(r.created_at) },
    {
      key: '_actions',
      label: '',
      headerClassName: 'w-16',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Exchange Rates' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Exchange Rates</h1>
          {latestRate && (
            <p className="text-sm text-gray-500 mt-0.5">
              Latest: 1 USD = <span className="font-semibold text-gray-800">{formatNumber(latestRate.usd_uzs, 0)} UZS</span>
              {' '}as of {formatDate(latestRate.date)}
            </p>
          )}
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setPanelOpen(true)}>
          Add Rate
        </Button>
      </div>

      <Table
        columns={columns}
        data={rates}
        loading={loading}
        rowKey="id"
        searchable={false}
        emptyMessage="No exchange rates recorded yet."
      />

      {/* Add Panel */}
      <SidePanel
        open={panelOpen}
        title="Add Exchange Rate"
        onClose={() => { setPanelOpen(false); setForm({ date: '', usd_uzs: '' }); setErrors({}) }}
        width="w-96"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            error={errors.date}
            required
          />
          <Input
            label="1 USD = UZS"
            type="number"
            value={form.usd_uzs}
            onChange={(e) => setForm((f) => ({ ...f, usd_uzs: e.target.value }))}
            error={errors.usd_uzs}
            required
            placeholder="e.g. 12750"
          />
          <p className="text-xs text-gray-500">
            Source is set to CBU (Central Bank of Uzbekistan).
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              Add Rate
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Exchange Rate"
        message={`Delete the rate for ${formatDate(deleteTarget?.date ?? '')}? This cannot be undone.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
