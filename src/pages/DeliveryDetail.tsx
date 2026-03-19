import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { useDelivery } from '../hooks/useDeliveries'
import { useDeliveryItems } from '../hooks/useDeliveryItems'
import { useDeliveryCosts } from '../hooks/useDeliveryCosts'
import { useProducts } from '../hooks/useProducts'
import { useSupplierCommissions } from '../hooks/useSupplierCommissions'
import { calcLandedCost, calcRecommendedPrice, calcSellableQty } from '../lib/calculations'
import { COST_TYPES, DELIVERY_STATUSES } from '../lib/constants'
import type {
  DeliveryItem, DeliveryItemInsert, DeliveryItemUpdate,
  DeliveryCost, DeliveryCostInsert, DeliveryCostUpdate,
  SupplierCommission, SupplierCommissionInsert,
  CostType, Currency, CommissionType,
} from '../types/database'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatDate, formatUSD, formatUZS, formatPct, formatNumber } from '../lib/formatters'

type Tab = 'items' | 'costs' | 'landed' | 'pricing' | 'timeline' | 'commissions'

const STATUS_BADGE_MAP: Record<string, 'neutral' | 'info' | 'indigo' | 'warning' | 'orange' | 'teal' | 'success'> = {
  ordered: 'neutral', invoiced: 'info', paid: 'indigo',
  in_transit: 'warning', customs: 'orange', cleared: 'teal', delivered: 'success',
}

// ─── Item Form ────────────────────────────────────────────────────────────────
const EMPTY_ITEM: Omit<DeliveryItemInsert, 'delivery_id'> = {
  product_id: '',
  quantity: 0,
  cip_price_usd: 0,
  margin_pct: 10,
  test_packs_qty: 1,
  official_price_uzs: null,
  notes: '',
}

// ─── Cost Form ────────────────────────────────────────────────────────────────
const EMPTY_COST: Omit<DeliveryCostInsert, 'delivery_id'> = {
  cost_type: 'customs_duty',
  description: '',
  amount: 0,
  currency: 'USD',
  amount_usd: 0,
  document_ref: '',
}

export function DeliveryDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('items')

  const { delivery, loading: deliveryLoading, refetch: refetchDelivery } = useDelivery(id)
  const { items, loading: itemsLoading, refetch: refetchItems, create: createItem, update: updateItem, remove: removeItem } = useDeliveryItems(id)
  const { costs, loading: costsLoading, create: createCost, update: updateCost, remove: removeCost } = useDeliveryCosts(id)
  const { products } = useProducts()
  const { commissions, loading: commissionsLoading, create: createCommission, update: updateCommission, remove: removeCommission, totalUsd: totalCommissionsUsd } = useSupplierCommissions(id)

  // Item panel state
  const [itemPanelOpen, setItemPanelOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [itemErrors, setItemErrors] = useState<Partial<Record<string, string>>>({})
  const [savingItem, setSavingItem] = useState(false)
  const [deleteItem, setDeleteItem] = useState<DeliveryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)

  // Cost panel state
  const [costPanelOpen, setCostPanelOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<DeliveryCost | null>(null)
  const [costForm, setCostForm] = useState(EMPTY_COST)
  const [costErrors, setCostErrors] = useState<Partial<Record<string, string>>>({})
  const [savingCost, setSavingCost] = useState(false)
  const [deleteCost, setDeleteCost] = useState<DeliveryCost | null>(null)
  const [deletingCost, setDeletingCost] = useState(false)

  // Commission panel state
  const [commissionPanelOpen, setCommissionPanelOpen] = useState(false)
  const [editingCommission, setEditingCommission] = useState<SupplierCommission | null>(null)
  const [commissionForm, setCommissionForm] = useState<{
    commission_type: CommissionType; amount_usd: string; description: string; paid: boolean; paid_date: string
  }>({ commission_type: 'supplier', amount_usd: '', description: '', paid: false, paid_date: '' })
  const [commissionErrors, setCommissionErrors] = useState<Partial<Record<string, string>>>({})
  const [savingCommission, setSavingCommission] = useState(false)
  const [deleteCommission, setDeleteCommission] = useState<SupplierCommission | null>(null)
  const [deletingCommission, setDeletingCommission] = useState(false)

  // Landed cost recalculate state
  const [recalculating, setRecalculating] = useState(false)

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name}${p.variety ? ` (${p.variety})` : ''} — ${p.crop_type}`,
  }))

  const costTypeOptions = COST_TYPES
  // ── Item handlers ────────────────────────────────────────────────────────────
  const openItemCreate = () => {
    setEditingItem(null)
    setItemForm(EMPTY_ITEM)
    setItemErrors({})
    setItemPanelOpen(true)
  }

  const openItemEdit = (item: DeliveryItem) => {
    setEditingItem(item)
    setItemForm({
      product_id: item.product_id,
      quantity: item.quantity,
      cip_price_usd: item.cip_price_usd,
      margin_pct: item.margin_pct,
      test_packs_qty: item.test_packs_qty,
      official_price_uzs: item.official_price_uzs,
      notes: item.notes ?? '',
    })
    setItemErrors({})
    setItemPanelOpen(true)
  }

  const validateItem = () => {
    const e: typeof itemErrors = {}
    if (!itemForm.product_id) e.product_id = 'Product is required'
    if (!itemForm.quantity || itemForm.quantity <= 0) e.quantity = 'Quantity must be > 0'
    if (!itemForm.cip_price_usd || itemForm.cip_price_usd <= 0) e.cip_price_usd = 'CIP price must be > 0'
    setItemErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveItem = async () => {
    if (!validateItem() || !id) return
    setSavingItem(true)
    const sellable = calcSellableQty(Number(itemForm.quantity), Number(itemForm.test_packs_qty))
    const payload = {
      product_id: itemForm.product_id,
      quantity: Number(itemForm.quantity),
      cip_price_usd: Number(itemForm.cip_price_usd),
      margin_pct: Number(itemForm.margin_pct) || 10,
      test_packs_qty: Number(itemForm.test_packs_qty) || 1,
      official_price_uzs: itemForm.official_price_uzs ? Number(itemForm.official_price_uzs) : null,
      sellable_qty: sellable,
      notes: itemForm.notes?.trim() || null,
    }
    const ok = editingItem
      ? await updateItem(editingItem.id, payload as DeliveryItemUpdate)
      : await createItem({ ...payload, delivery_id: id } as DeliveryItemInsert)
    setSavingItem(false)
    if (ok) { setItemPanelOpen(false); refetchDelivery() }
  }

  const handleDeleteItem = async () => {
    if (!deleteItem) return
    setDeletingItem(true)
    await removeItem(deleteItem.id)
    setDeletingItem(false)
    setDeleteItem(null)
    refetchDelivery()
  }

  // ── Cost handlers ────────────────────────────────────────────────────────────
  const openCostCreate = () => {
    setEditingCost(null)
    setCostForm(EMPTY_COST)
    setCostErrors({})
    setCostPanelOpen(true)
  }

  const openCostEdit = (cost: DeliveryCost) => {
    setEditingCost(cost)
    setCostForm({
      cost_type: cost.cost_type,
      description: cost.description ?? '',
      amount: cost.amount,
      currency: cost.currency,
      amount_usd: cost.amount_usd,
      document_ref: cost.document_ref ?? '',
    })
    setCostErrors({})
    setCostPanelOpen(true)
  }

  const validateCost = () => {
    const e: typeof costErrors = {}
    if (!costForm.amount || costForm.amount <= 0) e.amount = 'Amount must be > 0'
    if (!costForm.amount_usd || costForm.amount_usd <= 0) e.amount_usd = 'USD amount must be > 0'
    setCostErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveCost = async () => {
    if (!validateCost() || !id) return
    setSavingCost(true)
    const payload: Omit<DeliveryCostInsert, 'delivery_id'> = {
      cost_type: costForm.cost_type as CostType,
      description: costForm.description?.trim() || null,
      amount: Number(costForm.amount),
      currency: costForm.currency as Currency,
      amount_usd: Number(costForm.amount_usd),
      document_ref: costForm.document_ref?.trim() || null,
    }
    const ok = editingCost
      ? await updateCost(editingCost.id, payload as DeliveryCostUpdate)
      : await createCost({ ...payload, delivery_id: id })
    setSavingCost(false)
    if (ok) setCostPanelOpen(false)
  }

  const handleDeleteCost = async () => {
    if (!deleteCost) return
    setDeletingCost(true)
    await removeCost(deleteCost.id)
    setDeletingCost(false)
    setDeleteCost(null)
  }

  // ── Commission handlers ───────────────────────────────────────────────────────
  const openCommissionCreate = () => {
    setEditingCommission(null)
    setCommissionForm({ commission_type: 'supplier', amount_usd: '', description: '', paid: false, paid_date: '' })
    setCommissionErrors({})
    setCommissionPanelOpen(true)
  }

  const openCommissionEdit = (c: SupplierCommission) => {
    setEditingCommission(c)
    setCommissionForm({
      commission_type: c.commission_type,
      amount_usd: String(c.amount_usd),
      description: c.description ?? '',
      paid: c.paid,
      paid_date: c.paid_date ?? '',
    })
    setCommissionErrors({})
    setCommissionPanelOpen(true)
  }

  const validateCommission = () => {
    const e: typeof commissionErrors = {}
    if (!commissionForm.amount_usd || Number(commissionForm.amount_usd) <= 0) e.amount_usd = 'Amount must be > 0'
    setCommissionErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveCommission = async () => {
    if (!validateCommission() || !id) return
    setSavingCommission(true)
    if (editingCommission) {
      await updateCommission(editingCommission.id, {
        commission_type: commissionForm.commission_type,
        amount_usd: Number(commissionForm.amount_usd),
        description: commissionForm.description.trim() || null,
        paid: commissionForm.paid,
        paid_date: commissionForm.paid_date || null,
      })
    } else {
      const payload: SupplierCommissionInsert = {
        delivery_id: id,
        commission_type: commissionForm.commission_type,
        amount_usd: Number(commissionForm.amount_usd),
        description: commissionForm.description.trim() || null,
        paid: commissionForm.paid,
        paid_date: commissionForm.paid_date || null,
      }
      await createCommission(payload)
    }
    setSavingCommission(false)
    setCommissionPanelOpen(false)
  }

  const handleDeleteCommission = async () => {
    if (!deleteCommission) return
    setDeletingCommission(true)
    await removeCommission(deleteCommission.id)
    setDeletingCommission(false)
    setDeleteCommission(null)
  }

  // ── Landed Cost Recalculate ───────────────────────────────────────────────────
  const handleRecalculate = async () => {
    if (!delivery || items.length === 0) return
    setRecalculating(true)
    try {
      const results = calcLandedCost(delivery, items, costs)
      for (const r of results) {
        await supabase
          .from('delivery_items')
          .update({ landed_cost_usd: r.landed_cost_per_pack })
          .eq('id', r.item_id)
      }
      await refetchItems()
      toast('success', 'Landed costs recalculated')
    } catch {
      toast('error', 'Recalculation failed')
    }
    setRecalculating(false)
  }

  // ── Margin save ───────────────────────────────────────────────────────────────
  const handleSaveMargin = async (item: DeliveryItem, newMargin: number) => {
    if (!item.landed_cost_usd) {
      toast('warning', 'Calculate landed cost first')
      return
    }
    const product = products.find((p) => p.id === item.product_id)
    const { recommended_price } = calcRecommendedPrice(item.landed_cost_usd, newMargin, product?.map_price ?? null)
    await updateItem(item.id, {
      margin_pct: newMargin,
      recommended_price_usd: recommended_price,
    })
  }

  if (deliveryLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="text-center py-20 text-gray-400">Delivery not found.</div>
    )
  }

  const totalCosts = costs.reduce((s, c) => s + c.amount_usd, 0)
  const statusLabel = DELIVERY_STATUSES.find((s) => s.value === delivery.status)?.label ?? delivery.status

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Deliveries', href: '/deliveries' }, { label: delivery.invoice_number ?? 'New Delivery' }]} />
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {delivery.invoice_number ?? 'Delivery'} — {delivery.supplier?.name}
            </h1>
            <Badge variant={STATUS_BADGE_MAP[delivery.status] ?? 'neutral'} label={statusLabel} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Ordered {formatDate(delivery.order_date)} · Total CIP: {formatUSD(delivery.total_cip_usd)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {(['items', 'costs', 'landed', 'pricing', 'timeline', 'commissions'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-[#1a56db] text-[#1a56db]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab === 'landed' ? 'Landed Cost' : tab === 'commissions'
                ? `Commissions${commissions.length > 0 ? ` (${commissions.length})` : ''}`
                : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Items Tab ── */}
      {activeTab === 'items' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openItemCreate}>
              Add Item
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">CIP/pack</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total CIP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Test Packs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Sellable</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No items yet. Add the first invoice line.</td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product?.name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{item.product?.crop_type}{item.product?.variety ? ` · ${item.product.variety}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(item.quantity)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatUSD(item.cip_price_usd)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatUSD(item.total_cip_usd)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.test_packs_qty}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.sellable_qty ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{item.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openItemEdit(item)} className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteItem(item)} className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(items.reduce((s, i) => s + i.quantity, 0))}</td>
                    <td />
                    <td className="px-4 py-3 text-right font-semibold">{formatUSD(items.reduce((s, i) => s + i.total_cip_usd, 0))}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Costs Tab ── */}
      {activeTab === 'costs' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total costs: <span className="font-semibold text-gray-900">{formatUSD(totalCosts)}</span>
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCostCreate}>
              Add Cost
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount USD</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Doc Ref</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {costsLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : costs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No costs yet. Add customs, VAT, broker fees, etc.</td></tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {COST_TYPES.find((c) => c.value === cost.cost_type)?.label ?? cost.cost_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{cost.description ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatNumber(cost.amount, 2)} {cost.currency}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatUSD(cost.amount_usd)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{cost.document_ref ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openCostEdit(cost)} className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteCost(cost)} className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {costs.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatUSD(totalCosts)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Landed Cost Tab ── */}
      {activeTab === 'landed' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Allocates total delivery costs to each item proportionally by CIP value.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={handleRecalculate}
              loading={recalculating}
              disabled={items.length === 0}
            >
              Recalculate
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">Total CIP</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatUSD(delivery.total_cip_usd)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">Total Additional Costs</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatUSD(totalCosts)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">Grand Total (Landed)</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatUSD((delivery.total_cip_usd ?? 0) + totalCosts)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">CIP/pack</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Share</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Allocated Costs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Landed/pack</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const results = delivery ? calcLandedCost(delivery, items, costs) : []
                  const r = results.find((x) => x.item_id === item.id)
                  const landed = item.landed_cost_usd ?? r?.landed_cost_per_pack
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product?.name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{item.product?.crop_type}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatUSD(item.cip_price_usd)}</td>
                      <td className="px-4 py-3 text-right">{r ? formatPct(r.item_share * 100) : '—'}</td>
                      <td className="px-4 py-3 text-right">{r ? formatUSD(r.allocated_costs) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {landed != null ? formatUSD(landed) : <span className="text-gray-400">Not calculated</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pricing Tab ── */}
      {activeTab === 'pricing' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Recommended price = Landed cost × (1 + margin%). Red flag if it exceeds supplier MAP price.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Landed/pack</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Margin %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rec. Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">MAP Price</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Official UZS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const product = products.find((p) => p.id === item.product_id)
                  const landed = item.landed_cost_usd
                  const { recommended_price, exceeds_map } = landed != null
                    ? calcRecommendedPrice(landed, item.margin_pct, product?.map_price ?? null)
                    : { recommended_price: null, exceeds_map: false }

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product?.name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {landed != null ? formatUSD(landed) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MarginInput item={item} onSave={handleSaveMargin} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {recommended_price != null
                          ? <span className={exceeds_map ? 'text-red-600' : 'text-green-700'}>{formatUSD(recommended_price)}</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {product?.map_price != null ? `${formatUSD(product.map_price)} ${product.map_currency ?? ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {landed == null
                          ? <span className="text-xs text-gray-400">No landed cost</span>
                          : exceeds_map
                            ? <div className="flex items-center justify-center gap-1 text-red-600"><AlertTriangle size={14} /><span className="text-xs">Over MAP</span></div>
                            : <div className="flex items-center justify-center gap-1 text-green-600"><CheckCircle size={14} /><span className="text-xs">OK</span></div>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {item.official_price_uzs != null ? formatUZS(item.official_price_uzs) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Timeline Tab ── */}
      {activeTab === 'timeline' && (
        <div className="rounded-lg bg-white border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-6">Delivery Timeline</h2>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Order Placed', date: delivery.order_date, status: 'ordered' },
              { label: 'Invoice Received', date: delivery.invoice_date, status: 'invoiced' },
              { label: 'Payment Made', date: delivery.payment_date, status: 'paid' },
              { label: 'Shipped', date: delivery.ship_date, status: 'in_transit' },
              { label: 'Customs Started', date: delivery.customs_start_date, status: 'customs' },
              { label: 'Customs Cleared', date: delivery.customs_clear_date, status: 'cleared' },
              { label: 'Delivered', date: delivery.delivery_date, status: 'delivered' },
            ].map((step, i) => {
              const statusOrder = ['ordered', 'invoiced', 'paid', 'in_transit', 'customs', 'cleared', 'delivered']
              const currentIdx = statusOrder.indexOf(delivery.status)
              const stepIdx = statusOrder.indexOf(step.status)
              const isDone = stepIdx <= currentIdx
              return (
                <div key={i} className="flex items-start gap-4">
                  <div className={[
                    'shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
                    isDone ? 'bg-[#1a56db] text-white' : 'bg-gray-100 text-gray-400',
                  ].join(' ')}>
                    {isDone ? <CheckCircle size={16} /> : i + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={['text-sm font-medium', isDone ? 'text-gray-900' : 'text-gray-400'].join(' ')}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400">{step.date ? formatDate(step.date) : 'Not yet'}</p>
                  </div>
                  {delivery.status === step.status && (
                    <Badge variant={STATUS_BADGE_MAP[step.status] ?? 'neutral'} label="Current" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Commissions Tab ── */}
      {activeTab === 'commissions' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total commissions:{' '}
              <span className="font-semibold text-gray-900">{formatUSD(totalCommissionsUsd)}</span>
              {totalCommissionsUsd > 0 && (
                <span className="text-xs text-gray-400 ml-2">(subtracted from net profit)</span>
              )}
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCommissionCreate}>
              Add Commission
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount (USD)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid Date</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {commissionsLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : commissions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No commissions recorded for this delivery.</td></tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={[
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          c.commission_type === 'supplier'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800',
                        ].join(' ')}>
                          {c.commission_type === 'supplier' ? 'Supplier' : 'Manager'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.description ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatUSD(c.amount_usd)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.paid
                          ? <CheckCircle size={16} className="text-green-600 mx-auto" />
                          : <span className="text-xs text-gray-400">Unpaid</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.paid_date ? formatDate(c.paid_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openCommissionEdit(c)} className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteCommission(c)} className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {commissions.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatUSD(totalCommissionsUsd)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Item Panel ── */}
      <SidePanel open={itemPanelOpen} title={editingItem ? 'Edit Item' : 'Add Item'} onClose={() => setItemPanelOpen(false)}>
        <div className="flex flex-col gap-4">
          <Select
            label="Product"
            value={itemForm.product_id}
            onChange={(e) => setItemForm((f) => ({ ...f, product_id: e.target.value }))}
            options={productOptions}
            placeholder="Select product..."
            error={itemErrors.product_id}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity (packs)"
              type="number"
              value={itemForm.quantity || ''}
              onChange={(e) => setItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              error={itemErrors.quantity}
              required
            />
            <Input
              label="CIP Price/pack (USD)"
              type="number"
              value={itemForm.cip_price_usd || ''}
              onChange={(e) => setItemForm((f) => ({ ...f, cip_price_usd: Number(e.target.value) }))}
              error={itemErrors.cip_price_usd}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Test Packs"
              type="number"
              value={itemForm.test_packs_qty ?? 1}
              onChange={(e) => setItemForm((f) => ({ ...f, test_packs_qty: Number(e.target.value) }))}
            />
            <Input
              label="Margin %"
              type="number"
              value={itemForm.margin_pct ?? 10}
              onChange={(e) => setItemForm((f) => ({ ...f, margin_pct: Number(e.target.value) }))}
            />
          </div>
          <Input
            label="Official Price/pack (UZS)"
            type="number"
            value={itemForm.official_price_uzs ?? ''}
            onChange={(e) => setItemForm((f) => ({ ...f, official_price_uzs: e.target.value ? Number(e.target.value) : null }))}
            placeholder="For inkasso registration"
          />
          {itemForm.quantity > 0 && (
            <p className="text-xs text-gray-500">
              Sellable: {calcSellableQty(Number(itemForm.quantity), Number(itemForm.test_packs_qty ?? 1))} packs
              (after {itemForm.test_packs_qty ?? 1} test pack{(itemForm.test_packs_qty ?? 1) !== 1 ? 's' : ''})
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={itemForm.notes ?? ''}
              onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setItemPanelOpen(false)} disabled={savingItem}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSaveItem} loading={savingItem}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* ── Cost Panel ── */}
      <SidePanel open={costPanelOpen} title={editingCost ? 'Edit Cost' : 'Add Cost'} onClose={() => setCostPanelOpen(false)}>
        <div className="flex flex-col gap-4">
          <Select
            label="Cost Type"
            value={costForm.cost_type}
            onChange={(e) => setCostForm((f) => ({ ...f, cost_type: e.target.value as CostType }))}
            options={costTypeOptions}
          />
          <Input
            label="Description"
            value={costForm.description ?? ''}
            onChange={(e) => setCostForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional detail"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              value={costForm.amount || ''}
              onChange={(e) => setCostForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              error={costErrors.amount}
              required
            />
            <Select
              label="Currency"
              value={costForm.currency}
              onChange={(e) => setCostForm((f) => ({ ...f, currency: e.target.value as Currency }))}
              options={[{ value: 'USD', label: 'USD' }, { value: 'UZS', label: 'UZS' }]}
            />
          </div>
          <Input
            label="Amount in USD"
            type="number"
            value={costForm.amount_usd || ''}
            onChange={(e) => setCostForm((f) => ({ ...f, amount_usd: Number(e.target.value) }))}
            error={costErrors.amount_usd}
            required
            hint="Convert UZS costs to USD using the current exchange rate"
          />
          <Input
            label="Document Reference"
            value={costForm.document_ref ?? ''}
            onChange={(e) => setCostForm((f) => ({ ...f, document_ref: e.target.value }))}
            placeholder="Invoice or receipt number"
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setCostPanelOpen(false)} disabled={savingCost}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSaveCost} loading={savingCost}>
              {editingCost ? 'Save Changes' : 'Add Cost'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* ── Commission Panel ── */}
      <SidePanel open={commissionPanelOpen} title={editingCommission ? 'Edit Commission' : 'Add Commission'} onClose={() => setCommissionPanelOpen(false)}>
        <div className="flex flex-col gap-4">
          <Select
            label="Commission Type"
            value={commissionForm.commission_type}
            onChange={(e) => setCommissionForm((f) => ({ ...f, commission_type: e.target.value as CommissionType }))}
            options={[
              { value: 'supplier', label: 'Supplier Commission (e.g. Syngenta)' },
              { value: 'manager', label: 'Manager Commission' },
            ]}
          />
          <Input
            label="Amount (USD)"
            type="number"
            value={commissionForm.amount_usd}
            onChange={(e) => setCommissionForm((f) => ({ ...f, amount_usd: e.target.value }))}
            error={commissionErrors.amount_usd}
            required
          />
          <Input
            label="Description"
            value={commissionForm.description}
            onChange={(e) => setCommissionForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Syngenta delivery commission"
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="commission-paid"
              checked={commissionForm.paid}
              onChange={(e) => setCommissionForm((f) => ({ ...f, paid: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="commission-paid" className="text-sm font-medium text-gray-700">Paid</label>
          </div>
          {commissionForm.paid && (
            <Input
              label="Paid Date"
              type="date"
              value={commissionForm.paid_date}
              onChange={(e) => setCommissionForm((f) => ({ ...f, paid_date: e.target.value }))}
            />
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setCommissionPanelOpen(false)} disabled={savingCommission}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSaveCommission} loading={savingCommission}>
              {editingCommission ? 'Save Changes' : 'Add Commission'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Modals */}
      <Modal open={!!deleteItem} title="Remove Item" danger
        message={`Remove "${deleteItem?.product?.name ?? 'this item'}" from the delivery?`}
        confirmLabel="Remove" onConfirm={handleDeleteItem} onCancel={() => setDeleteItem(null)} loading={deletingItem} />
      <Modal open={!!deleteCost} title="Delete Cost" danger
        message={`Delete this ${COST_TYPES.find((c) => c.value === deleteCost?.cost_type)?.label ?? 'cost'} entry?`}
        confirmLabel="Delete" onConfirm={handleDeleteCost} onCancel={() => setDeleteCost(null)} loading={deletingCost} />
      <Modal open={!!deleteCommission} title="Delete Commission" danger
        message="Delete this commission entry? It will be removed from P&L calculations."
        confirmLabel="Delete" onConfirm={handleDeleteCommission} onCancel={() => setDeleteCommission(null)} loading={deletingCommission} />
    </div>
  )
}

// ── Inline margin input ───────────────────────────────────────────────────────
function MarginInput({ item, onSave }: { item: DeliveryItem; onSave: (item: DeliveryItem, margin: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(item.margin_pct))

  const commit = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) onSave(item, n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-16 rounded border border-blue-400 px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={() => { setVal(String(item.margin_pct)); setEditing(true) }}
      className="text-sm text-gray-900 hover:text-blue-600 hover:underline"
    >
      {formatPct(item.margin_pct)}
    </button>
  )
}
