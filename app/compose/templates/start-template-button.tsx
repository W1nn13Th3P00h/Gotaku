'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { startSessionFromTemplate } from '@/lib/sessions/mutations'
import { createClient } from '@/lib/supabase/client'

type Props = {
  templateId: string
}

export function StartTemplateButton({ templateId }: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  async function handleClick() {
    if (starting) return
    setStarting(true)
    const supabase = createClient()
    const { sessionId } = await startSessionFromTemplate(supabase, templateId)
    router.push(`/session/${sessionId}`)
  }

  return (
    <Button variant="primary" onClick={handleClick} disabled={starting} className="shrink-0">
      {starting ? 'Démarrage…' : 'Démarrer'}
    </Button>
  )
}
