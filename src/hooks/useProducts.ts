import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, ProductInsert, ProductUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export interface DeliveryItemImport {
  id: string
  product_id: string
  delivery_id: string
  cip_price_usd: number
  margin_pct: number
  official_price_uzs: number | null
  test_packs_qty: number
  sellable_qty: number | null
  quantity: number
  recommended_price_usd: number | null
  notes: string | null
  created_at: string
  delivery?: {
    id: string
    invoice_number: string | null
    invoice_date: string | null
    delivery_date: string | null
  }
}

export interface ProductWithStats extends Product {
  importCount: number
  latestCip: number | null
  latestImport: DeliveryItemImport | null
  latestRetailPrice: number | null
}

export function useProducts() {
  const [products, setProducts] = useState<ProductWithStats[]>([])
  const [importsByProduct, setImportsByProduct] = useState<Map<string, DeliveryItemImport[]>>(new Map())
  const [soldByDeliveryItem, setSoldByDeliveryItem] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [productsRes, itemsRes, salesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, supplier_id, name, crop_type, variety, unit, seeds_per_pack, map_price, map_currency, notes, is_active, created_at, updated_at, supplier:suppliers(id, name, country)')
        .order('name'),
      supabase
        .from('delivery_items')
        .select(`
          id, product_id, delivery_id, cip_price_usd, margin_pct, official_price_uzs,
          test_packs_qty, sellable_qty, quantity, recommended_price_usd, notes, created_at,
          delivery:deliveries(id, invoice_number, invoice_date, delivery_date)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('sales')
        .select('id, delivery_item_id, sale_date, quantity, real_price_per_pack')
        .order('sale_date', { ascending: false }),
    ])

    if (productsRes.error) {
      toast('error', 'Failed to load products', productsRes.error.message)
      setLoading(false)
      return
    }

    // Normalize delivery items (delivery join may be array)
    const allItems: DeliveryItemImport[] = (itemsRes.data ?? []).map((row) => ({
      ...row,
      delivery: Array.isArray(row.delivery) ? (row.delivery[0] ?? undefined) : (row.delivery ?? undefined),
    })) as DeliveryItemImport[]

    // Group by product_id (already desc by created_at → index 0 = latest)
    const byProduct = new Map<string, DeliveryItemImport[]>()
    for (const item of allItems) {
      const list = byProduct.get(item.product_id) ?? []
      list.push(item)
      byProduct.set(item.product_id, list)
    }

    // Build delivery_item_id → product_id cross-reference
    const itemToProduct = new Map<string, string>()
    for (const item of allItems) {
      itemToProduct.set(item.id, item.product_id)
    }

    // Build sold count per delivery_item and latest retail per product (sales sorted desc by sale_date)
    const soldMap = new Map<string, number>()
    const latestRetailByProduct = new Map<string, number>()
    for (const sale of (salesRes.data ?? []) as { delivery_item_id: string; quantity: number; real_price_per_pack: number }[]) {
      soldMap.set(sale.delivery_item_id, (soldMap.get(sale.delivery_item_id) ?? 0) + sale.quantity)
      const productId = itemToProduct.get(sale.delivery_item_id)
      if (productId && !latestRetailByProduct.has(productId)) {
        latestRetailByProduct.set(productId, sale.real_price_per_pack)
      }
    }

    const normalized: ProductWithStats[] = (productsRes.data ?? []).map((row) => {
      const product = {
        ...row,
        supplier: Array.isArray(row.supplier) ? (row.supplier[0] ?? null) : row.supplier,
      } as unknown as Product
      const imports = byProduct.get(product.id) ?? []
      return {
        ...product,
        importCount: imports.length,
        latestCip: imports[0]?.cip_price_usd ?? null,
        latestImport: imports[0] ?? null,
        latestRetailPrice: latestRetailByProduct.get(product.id) ?? null,
      }
    })

    setProducts(normalized)
    setImportsByProduct(byProduct)
    setSoldByDeliveryItem(soldMap)
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

  const updateImportNotes = async (deliveryItemId: string, notes: string | null): Promise<boolean> => {
    const { error } = await supabase.from('delivery_items').update({ notes }).eq('id', deliveryItemId)
    if (error) { toast('error', 'Failed to update import notes', error.message); return false }
    toast('success', 'Notes saved')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      console.log('Delete product error:', error.message)
      if (error.message.includes('violates foreign key constraint')) {
        toast('error', 'Cannot delete this product', "It's used in one or more deliveries. Remove it from deliveries first.")
      } else {
        toast('error', 'Failed to delete product', error.message)
      }
      return false
    }
    toast('success', 'Product deleted')
    await fetch()
    return true
  }

  return { products, importsByProduct, soldByDeliveryItem, loading, refetch: fetch, create, update, updateImportNotes, remove }
}
