import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Dealer, DealerInsert, DealerUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useDealers() {
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('dealers')
      .select('id, name, contact_person, phone, email, region, payment_terms, notes, created_at, updated_at')
      .order('name')
    if (error) {
      toast('error', 'Failed to load dealers', error.message)
    } else {
      setDealers(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: DealerInsert): Promise<boolean> => {
    const { error } = await supabase.from('dealers').insert(values)
    if (error) { toast('error', 'Failed to create dealer', error.message); return false }
    toast('success', 'Dealer created')
    await fetch()
    return true
  }

  const update = async (id: string, values: DealerUpdate): Promise<boolean> => {
    const { error } = await supabase.from('dealers').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update dealer', error.message); return false }
    toast('success', 'Dealer updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('dealers').delete().eq('id', id)
    if (error) {
      console.log('Delete dealer error:', error.message)
      if (error.message.includes('violates foreign key constraint')) {
        toast('error', 'Cannot delete this dealer', 'They have sales records linked. Remove those first.')
      } else {
        toast('error', 'Failed to delete dealer', error.message)
      }
      return false
    }
    toast('success', 'Dealer deleted')
    await fetch()
    return true
  }

  return { dealers, loading, refetch: fetch, create, update, remove }
}
