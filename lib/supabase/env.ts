/**
 * Lecture centralisée de la configuration Supabase.
 *
 * Supabase a renommé ses clés : les projets récents exposent une clé publiable
 * `sb_publishable_…` et une clé secrète `sb_secret_…`, les anciens une clé anon et
 * une clé service role. Les deux jeux de noms sont acceptés, ce qui évite de devoir
 * deviner l'âge du projet.
 *
 * Aucune clé n'est écrite en dur nulle part. Tout vient de `.env.local`, qui n'est
 * pas versionné.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copie .env.example vers .env.local et remplis-la.`,
    )
  }
  return value
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/** Clé exposée au navigateur. Lecture seule sous RLS, jamais d'écriture sur la banque. */
export function supabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)', key)
}

/**
 * Clé de service. Contourne la RLS, ne doit jamais être importée par du code qui
 * finit dans le bundle navigateur. Utilisée uniquement par `npm run seed`.
 */
export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  return required('SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY)', key)
}
