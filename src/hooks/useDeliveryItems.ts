import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DeliveryItem, DeliveryItemInsert, DeliveryItemUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useDeliveryItems(deliveryId: string | undefined) {
  const [items, setItems] = useState<DeliveryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!deliveryId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_items')
      .select(`
        id, delivery_id, product_id, quantity, cip_price_usd, total_cip_usd,
        landed_cost_usd, recommended_price_usd, margin_pct,
        official_price_uzs, test_packs_qty, sellable_qty, notes, created_at,
        product:products(id, name, crop_type, variety, unit, map_price, map_currency, supplier_id)
      `)
      .eq('delivery_id', deliveryId)
      .order('created_at')
    if (error) {
      toast('error', 'Failed to load delivery items', error.message)
    } else {
      const normalized = (data ?? []).map((row) => ({
        ...row,
        product: Array.isArray(row.product) ? row.product[0] ?? null : row.product,
      }))
      setItems(normalized as unknown as DeliveryItem[])
    }
    setLoading(false)
  }, [deliveryId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: DeliveryItemInsert): Promise<boolean> => {
    // Never include total_cip_usd — it's a GENERATED column
    const { error } = await supabase.from('delivery_items').insert(values)
    if (error) { toast('error', 'Failed to add item', error.message); return false }
    toast('success', 'Item added')
    await fetch()
    return true
  }

  const update = async (id: string, values: DeliveryItemUpdate): Promise<boolean> => {
    // Never include total_cip_usd — it's a GENERATED column
    const { error } = await supabase.from('delivery_items').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update item', error.message); return false }
    toast('success', 'Item updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_items').delete().eq('id', id)
    if (error) { toast('error', 'Failed to remove item', error.message); return false }
    toast('success', 'Item removed')
    await fetch()
    return true
  }

  return { items, loading, refetch: fetch, create, update, remove }
}
