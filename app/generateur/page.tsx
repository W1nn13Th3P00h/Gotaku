import { loadCatalog, loadGeneratorHistory } from '@/lib/bank/catalog'
import { createClient } from '@/lib/supabase/server'

import { GeneratorScreen } from '@/app/generateur/generator-screen'

// Le catalogue et l'historique dépendent de l'utilisateur connecté (RLS) et
// doivent refléter la banque à l'instant du tap, jamais une réponse mise en
// cache d'un précédent visiteur ou d'une précédente génération.
export const dynamic = 'force-dynamic'

export default async function GeneratorPage() {
  const supabase = await createClient()

  const catalog = await loadCatalog(supabase)
  const history = await loadGeneratorHistory(supabase, catalog)

  // Props RSC : uniquement des types sérialisables simples (chaînes, nombres),
  // les `Map`/`Date` du module `lib/bank/catalog.ts` sont reconstruites côté client.
  const lastPerformed = Object.fromEntries(
    [...history.lastPerformed].map(([id, date]) => [id, date.toISOString()]),
  )
  const zoneVolume30d = Object.fromEntries(history.zoneVolume30d)

  return <GeneratorScreen catalog={catalog} lastPerformed={lastPerformed} zoneVolume30d={zoneVolume30d} />
}
