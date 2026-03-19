import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, ProductInsert, ProductUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, supplier_id, name, crop_type, variety, unit, seeds_per_pack, map_price, map_currency, notes, is_active, created_at, updated_at, supplier:suppliers(id, name, country)')
      .order('name')
    if (error) {
      toast('error', 'Failed to load products', error.message)
    } else {
      // Supabase returns joined supplier as array; normalize to single object
      const normalized = (data ?? []).map((row) => ({
        ...row,
        supplier: Array.isArray(row.supplier) ? row.supplier[0] ?? null : row.supplier,
      }))
      setProducts(normalized as unknown as Product[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: ProductInsert): Promise<boolean> => {
    const { error } = await supabase.from('products').insert(values)
    if (error) { toast('error', 'Failed to create product', error.message); return false }
    toast('success', 'Product created')
    await fetch()
    return true
  }

  const update = async (id: string, values: ProductUpdate): Promise<boolean> => {
    const { error } = await supabase.from('products').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update product', error.message); return false }
    toast('success', 'Product updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete product', error.message); return false }
    toast('success', 'Product deleted')
    await fetch()
    return true
  }

  return { products, loading, refetch: fetch, create, update, remove }
}
