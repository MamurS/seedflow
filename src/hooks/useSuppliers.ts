import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Supplier, SupplierInsert, SupplierUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, country, contact_person, email, phone, payment_terms, notes, created_at, updated_at')
      .order('name')
    if (error) {
      toast('error', 'Failed to load suppliers', error.message)
    } else {
      setSuppliers(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: SupplierInsert): Promise<boolean> => {
    const { error } = await supabase.from('suppliers').insert(values)
    if (error) { toast('error', 'Failed to create supplier', error.message); return false }
    toast('success', 'Supplier created')
    await fetch()
    return true
  }

  const update = async (id: string, values: SupplierUpdate): Promise<boolean> => {
    const { error } = await supabase.from('suppliers').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update supplier', error.message); return false }
    toast('success', 'Supplier updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete supplier', error.message); return false }
    toast('success', 'Supplier deleted')
    await fetch()
    return true
  }

  return { suppliers, loading, refetch: fetch, create, update, remove }
}
