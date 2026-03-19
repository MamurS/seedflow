import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Inkasso, InkassoInsert, InkassoUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useInkasso() {
  const [inkassos, setInkassos] = useState<Inkasso[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('inkasso')
      .select('id, inkasso_date, total_amount_uzs, notes, created_at')
      .order('inkasso_date', { ascending: false })

    if (error) {
      toast('error', 'Failed to load inkasso records', error.message)
    } else {
      setInkassos((data ?? []) as Inkasso[])
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: InkassoInsert): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').insert(values)
    if (error) { toast('error', 'Failed to record inkasso', error.message); return false }
    toast('success', 'Inkasso recorded')
    await fetch()
    return true
  }

  const update = async (id: string, values: InkassoUpdate): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update inkasso', error.message); return false }
    toast('success', 'Inkasso updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete inkasso', error.message); return false }
    toast('success', 'Inkasso deleted')
    await fetch()
    return true
  }

  return { inkassos, loading, refetch: fetch, create, update, remove }
}
