import { SessionPlayerScreen } from '@/app/session/[id]/session-player-screen'

/** Placeholder T001 : le chargement réel de la séance arrive en Phase 3 (User Story 1). */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await params
  return <SessionPlayerScreen />
}
