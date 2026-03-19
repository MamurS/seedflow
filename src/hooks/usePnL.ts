import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Delivery, DeliveryItem, Sale, OpexAllocation } from '../types/database'
import { toast } from '../components/ui/Toast'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T
  return val as T
}

export function usePnL() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [allItems, setAllItems] = useState<DeliveryItem[]>([])
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [allAllocations, setAllAllocations] = useState<OpexAllocation[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [dr, ir, sr, ar] = await Promise.all([
      supabase
        .from('deliveries')
        .select('id, invoice_number, status, total_cip_usd, cycle_start_month, cycle_end_month, created_at, supplier:suppliers(id, name)')
        .order('created_at'),
      supabase
        .from('delivery_items')
        .select('id, delivery_id, quantity, landed_cost_usd, sellable_qty, product:products(id, name)'),
      supabase
        .from('sales')
        .select('id, delivery_item_id, sale_date, quantity, total_real_usd, real_price_per_pack, payment_status')
        .order('sale_date'),
      supabase
        .from('opex_allocation')
        .select('id, delivery_id, month, allocated_amount_usd'),
    ])

    if (dr.error) toast('error', 'Failed to load deliveries', dr.error.message)
    if (ir.error) toast('error', 'Failed to load items', ir.error.message)
    if (sr.error) toast('error', 'Failed to load sales', sr.error.message)

    setDeliveries(
      (dr.data ?? []).map((d) => ({ ...d, supplier: normalizeJoin(d.supplier) })) as unknown as Delivery[],
    )
    setAllItems(
      (ir.data ?? []).map((i) => ({ ...i, product: normalizeJoin(i.product) })) as unknown as DeliveryItem[],
    )
    setAllSales((sr.data ?? []) as unknown as Sale[])
    setAllAllocations((ar.data ?? []) as unknown as OpexAllocation[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { deliveries, allItems, allSales, allAllocations, loading, refetch: fetch }
}
