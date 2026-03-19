import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CashRegister, CashRegisterInsert, CashRegisterUpdate, DeliveryItem } from '../types/database'
import { toast } from '../components/ui/Toast'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T | null
  return val as T
}

export interface CashRegisterRow extends CashRegister {
  delivery_item?: DeliveryItem & {
    product?: { id: string; name: string }
    delivery?: { id: string; invoice_number: string | null }
  }
}

// Per delivery_item aggregated summary
export interface DeliveryItemCashStatus {
  delivery_item_id: string
  product_name: string
  invoice_number: string | null
  delivery_id: string
  sellable_qty: number
  official_price_uzs: number | null
  total_registered_packs: number
  remaining_packs: number
  registered_amount_uzs: number
  remaining_amount_uzs: number
  item: DeliveryItem & {
    product?: { id: string; name: string }
    delivery?: { id: string; invoice_number: string | null }
  }
}

const CR_SELECT = `
  id, delivery_item_id, register_date, packs_registered, amount_uzs,
  receipt_number, notes, created_at,
  delivery_item:delivery_items(
    id, delivery_id, sellable_qty, official_price_uzs, landed_cost_usd,
    product:products(id, name),
    delivery:deliveries(id, invoice_number)
  )
`

function normalizeRow(row: Record<string, unknown>): CashRegisterRow {
  const di = normalizeJoin<Record<string, unknown>>(row.delivery_item)
  if (!di) return row as unknown as CashRegisterRow
  return {
    ...row,
    delivery_item: {
      ...di,
      product: normalizeJoin(di.product),
      delivery: normalizeJoin(di.delivery),
    },
  } as unknown as CashRegisterRow
}

export function useCashRegister() {
  const [entries, setEntries] = useState<CashRegisterRow[]>([])
  const [allItems, setAllItems] = useState<CashRegisterRow['delivery_item'][]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('cash_register')
      .select(CR_SELECT)
      .order('register_date', { ascending: false })

    if (error) {
      toast('error', 'Failed to load cash register entries', error.message)
    } else {
      setEntries((data ?? []).map((r) => normalizeRow(r as Record<string, unknown>)))
    }

    // Also load all delivery items (for the main table)
    const { data: itemsData, error: itemsErr } = await supabase
      .from('delivery_items')
      .select(`
        id, delivery_id, sellable_qty, official_price_uzs, landed_cost_usd,
        product:products(id, name),
        delivery:deliveries(id, invoice_number)
      `)
      .not('sellable_qty', 'is', null)
      .gt('sellable_qty', 0)

    if (!itemsErr) {
      setAllItems(
        (itemsData ?? []).map((i) => ({
          ...i,
          product: normalizeJoin(i.product),
          delivery: normalizeJoin(i.delivery),
        })) as CashRegisterRow['delivery_item'][]
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: CashRegisterInsert): Promise<boolean> => {
    const { error } = await supabase.from('cash_register').insert(values)
    if (error) { toast('error', 'Failed to record cash registration', error.message); return false }
    toast('success', 'Cash registration recorded')
    await fetch()
    return true
  }

  const update = async (id: string, values: CashRegisterUpdate): Promise<boolean> => {
    const { error } = await supabase.from('cash_register').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update cash registration', error.message); return false }
    toast('success', 'Cash registration updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('cash_register').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete cash registration', error.message); return false }
    toast('success', 'Cash registration deleted')
    await fetch()
    return true
  }

  // Compute per-delivery-item summary
  const itemStatuses: DeliveryItemCashStatus[] = allItems
    .filter((item): item is NonNullable<typeof item> => item != null)
    .map((item) => {
      const itemEntries = entries.filter((e) => e.delivery_item_id === item.id)
      const totalRegistered = itemEntries.reduce((s, e) => s + e.packs_registered, 0)
      const sellable = item.sellable_qty ?? 0
      const remaining = Math.max(0, sellable - totalRegistered)
      const officialPrice = item.official_price_uzs ?? 0
      const registeredAmount = itemEntries.reduce((s, e) => s + e.amount_uzs, 0)
      const remainingAmount = remaining * officialPrice

      return {
        delivery_item_id: item.id,
        product_name: item.product?.name ?? '—',
        invoice_number: item.delivery?.invoice_number ?? null,
        delivery_id: item.delivery_id,
        sellable_qty: sellable,
        official_price_uzs: item.official_price_uzs,
        total_registered_packs: totalRegistered,
        remaining_packs: remaining,
        registered_amount_uzs: registeredAmount,
        remaining_amount_uzs: remainingAmount,
        item,
      }
    })

  const totalRemaining = itemStatuses.reduce((s, r) => s + r.remaining_packs, 0)
  const totalRemainingUZS = itemStatuses.reduce((s, r) => s + r.remaining_amount_uzs, 0)
  const totalRegistered = itemStatuses.reduce((s, r) => s + r.total_registered_packs, 0)
  const totalRegisteredUZS = itemStatuses.reduce((s, r) => s + r.registered_amount_uzs, 0)

  return {
    entries,
    allItems,
    itemStatuses,
    loading,
    refetch: fetch,
    create,
    update,
    remove,
    totals: { totalRemaining, totalRemainingUZS, totalRegistered, totalRegisteredUZS },
  }
}
