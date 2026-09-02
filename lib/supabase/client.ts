import { createBrowserClient } from '@supabase/ssr'

import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'

/** Client Supabase côté navigateur. Une instance par composant, le SDK déduplique. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublicKey())
}
