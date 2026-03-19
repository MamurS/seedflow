import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T
  return val as T
}

export interface PricingItem {
  id: string
  delivery_id: string
  quantity: number
  cip_price_usd: number
  total_cip_usd: number
  landed_cost_usd: number | null
  recommended_price_usd: number | null
  margin_pct: number
  sellable_qty: number | null
  product: {
    id: string
    name: string
    map_price: number | null
    map_currency: string | null
  } | null
  delivery: {
    id: string
    invoice_number: string | null
    invoice_date: string | null
    supplier: { name: string } | null
  } | null
}

export function usePricing() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_items')
      .select(`
        id, delivery_id, quantity, cip_price_usd, total_cip_usd,
        landed_cost_usd, recommended_price_usd, margin_pct, sellable_qty,
        product:products(id, name, map_price, map_currency),
        delivery:deliveries(id, invoice_number, invoice_date, supplier:suppliers(name))
      `)
      .order('created_at', { ascending: false })

    if (error) toast('error', 'Failed to load pricing data', error.message)

    const normalized = (data ?? []).map((item) => {
      const rawDelivery = normalizeJoin<Record<string, unknown>>(item.delivery)
      return {
        ...item,
        product: normalizeJoin(item.product),
        delivery: rawDelivery
          ? { ...rawDelivery, supplier: normalizeJoin(rawDelivery.supplier) }
          : null,
      }
    })

    setItems(normalized as unknown as PricingItem[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, refetch: fetch }
}
