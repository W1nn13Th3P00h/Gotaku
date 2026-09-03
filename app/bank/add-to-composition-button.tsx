'use client'

import { useState } from 'react'

import { addItemToComposition } from '@/lib/sessions/mutations'
import { getOrCreateDraftComposition } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/client'

type Props = {
  exerciseId: string
}

type Status = 'idle' | 'pending' | 'done' | 'error'

/**
 * Ajoute l'exercice à la composition manuelle en cours (Lot 4), en la créant
 * si besoin (`getOrCreateDraftComposition`). Reste sur `/bank` : l'utilisateur
 * peut ajouter plusieurs exercices avant de rejoindre `/compose`.
 */
export function AddToCompositionButton({ exerciseId }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleClick() {
    setStatus('pending')
    try {
      const supabase = createClient()
      const composition = await getOrCreateDraftComposition(supabase)
      await addItemToComposition(supabase, composition.sessionId, exerciseId)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'pending'}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
    >
      {status === 'done' ? 'Ajouté ✓' : status === 'error' ? 'Erreur, réessayer' : '+ Composition'}
    </button>
  )
}
