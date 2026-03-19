import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Sale, SaleInsert, SaleUpdate, PaymentTerms } from '../types/database'
import { toast } from '../components/ui/Toast'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T | null
  return val as T
}

export function calcPaymentDueDate(saleDate: string, terms: PaymentTerms): string {
  const d = new Date(saleDate)
  if (terms === 'deferred_30') d.setDate(d.getDate() + 30)
  else if (terms === 'deferred_60') d.setDate(d.getDate() + 60)
  else if (terms === 'deferred_90') d.setDate(d.getDate() + 90)
  return d.toISOString().split('T')[0]
}

export interface DeliveryItemOption {
  id: string
  label: string
  product_name: string
  invoice_number: string | null
  sellable_qty: number | null
  available_qty: number
  official_price_uzs: number | null
}

const SALE_SELECT = `
  id, dealer_id, delivery_item_id, sale_date, quantity,
  real_price_per_pack, official_price_per_pack_uzs,
  total_real_usd, total_official_uzs,
  payment_terms, payment_due_date, payment_status, payment_received_date,
  notes, created_at, updated_at,
  dealer:dealers(id, name),
  delivery_item:delivery_items(
    id, product_id, delivery_id, quantity, sellable_qty, official_price_uzs,
    product:products(id, name, crop_type, variety),
    delivery:deliveries(id, invoice_number)
  )
`

function normalizeSale(row: Record<string, unknown>): Sale {
  const di = normalizeJoin<Record<string, unknown>>(row.delivery_item)
  return {
    ...row,
    dealer: normalizeJoin(row.dealer),
    delivery_item: di
      ? {
          ...di,
          product: normalizeJoin(di.product),
          delivery: normalizeJoin(di.delivery),
        }
      : null,
  } as unknown as Sale
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [deliveryItemOptions, setDeliveryItemOptions] = useState<DeliveryItemOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(SALE_SELECT)
      .order('sale_date', { ascending: false })

    if (salesError) {
      toast('error', 'Failed to load sales', salesError.message)
      setLoading(false)
      return
    }

    const normalized = (salesData ?? []).map((r) => normalizeSale(r as Record<string, unknown>))
    setSales(normalized)

    // Build sold-qty map from current sales
    const soldByItem = new Map<string, number>()
    for (const s of normalized) {
      const prev = soldByItem.get(s.delivery_item_id) ?? 0
      soldByItem.set(s.delivery_item_id, prev + s.quantity)
    }

    // Fetch all delivery items for the "New Sale" dropdown
    const { data: diData, error: diError } = await supabase
      .from('delivery_items')
      .select(`
        id, sellable_qty, official_price_uzs,
        product:products(id, name),
        delivery:deliveries(id, invoice_number)
      `)
      .not('sellable_qty', 'is', null)
      .order('created_at', { ascending: false })

    if (!diError) {
      const opts: DeliveryItemOption[] = (diData ?? []).map((di) => {
        const product = normalizeJoin<{ name: string }>(di.product)
        const delivery = normalizeJoin<{ invoice_number: string | null }>(di.delivery)
        const sold = soldByItem.get(di.id) ?? 0
        const sellable = di.sellable_qty ?? 0
        const available = Math.max(0, sellable - sold)
        const inv = delivery?.invoice_number
        return {
          id: di.id,
          label: `${product?.name ?? 'Product'}${inv ? ` — Invoice #${inv}` : ''} (available: ${available} packs)`,
          product_name: product?.name ?? '',
          invoice_number: inv ?? null,
          sellable_qty: di.sellable_qty,
          available_qty: available,
          official_price_uzs: di.official_price_uzs,
        }
      })
      setDeliveryItemOptions(opts)
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  /** Available stock for a delivery item, optionally excluding one sale (for edits). */
  const getAvailableQty = (deliveryItemId: string, excludeSaleId?: string): number => {
    const opt = deliveryItemOptions.find((o) => o.id === deliveryItemId)
    if (!opt) return 0
    const sold = sales
      .filter((s) => s.delivery_item_id === deliveryItemId && s.id !== excludeSaleId)
      .reduce((sum, s) => sum + s.quantity, 0)
    return Math.max(0, (opt.sellable_qty ?? 0) - sold)
  }

  const buildAutoFields = (
    saleDate: string,
    terms: PaymentTerms,
    qty: number,
    realPrice: number,
    officialUzs: number | null | undefined,
  ) => ({
    total_real_usd: qty * realPrice,
    total_official_uzs: officialUzs != null ? qty * officialUzs : null,
    payment_due_date: calcPaymentDueDate(saleDate, terms),
  })

  const create = async (values: SaleInsert): Promise<boolean> => {
    const available = getAvailableQty(values.delivery_item_id)
    if (values.quantity > available) {
      toast('error', 'Insufficient stock', `Only ${available} packs available`)
      return false
    }
    const auto = buildAutoFields(
      values.sale_date,
      values.payment_terms,
      values.quantity,
      values.real_price_per_pack,
      values.official_price_per_pack_uzs,
    )
    const { error } = await supabase.from('sales').insert({ ...values, ...auto })
    if (error) { toast('error', 'Failed to create sale', error.message); return false }
    toast('success', 'Sale created')
    await fetch()
    return true
  }

  const update = async (id: string, values: SaleUpdate, originalDeliveryItemId?: string): Promise<boolean> => {
    if (values.quantity !== undefined && originalDeliveryItemId) {
      const available = getAvailableQty(originalDeliveryItemId, id)
      if (values.quantity > available) {
        toast('error', 'Insufficient stock', `Only ${available} packs available`)
        return false
      }
    }
    // Recompute totals and due date if key fields changed
    const payload: SaleUpdate = { ...values }
    if (values.sale_date && values.payment_terms) {
      payload.payment_due_date = calcPaymentDueDate(values.sale_date, values.payment_terms)
    }
    if (values.quantity !== undefined && values.real_price_per_pack !== undefined) {
      payload.total_real_usd = values.quantity * values.real_price_per_pack
    }
    if (values.quantity !== undefined && values.official_price_per_pack_uzs !== undefined) {
      payload.total_official_uzs = values.official_price_per_pack_uzs != null
        ? values.quantity * values.official_price_per_pack_uzs
        : null
    }
    const { error } = await supabase.from('sales').update(payload).eq('id', id)
    if (error) { toast('error', 'Failed to update sale', error.message); return false }
    toast('success', 'Sale updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete sale', error.message); return false }
    toast('success', 'Sale deleted')
    await fetch()
    return true
  }

  return { sales, deliveryItemOptions, loading, refetch: fetch, create, update, remove, getAvailableQty }
}
