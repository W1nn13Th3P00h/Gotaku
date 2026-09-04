'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { addItemToComposition } from '@/lib/sessions/mutations'
import { getOrCreateDraftComposition } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/client'

type Props = {
  exerciseId: string
}

type Status = 'idle' | 'pending' | 'done' | 'error'

const LABELS: Record<Status, string> = {
  idle: '+ Composition',
  pending: 'Ajout…',
  done: 'Ajouté ✓',
  error: 'Erreur, réessayer',
}

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
    <Button
      size="sm"
      onClick={handleClick}
      disabled={status === 'pending'}
      className="shrink-0"
      /* L'état est porté par le libellé, qui change : annoncé poliment plutôt
         que laissé silencieux pour un lecteur d'écran. */
      aria-live="polite"
    >
      {LABELS[status]}
    </Button>
  )
}
