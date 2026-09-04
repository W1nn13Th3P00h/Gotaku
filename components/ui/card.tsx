import type { ReactNode } from 'react'

/** Bloc encadré : l'unité de regroupement de toute l'app. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={['rounded-xl border border-border p-4', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/**
 * Liste encadrée à séparateurs internes. Un seul cadre pour n lignes : c'est ce
 * qui distingue une énumération homogène (banque, modèles, historique) d'une
 * pile de cartes indépendantes.
 */
export function CardList({
  children,
  ordered = false,
  className = '',
}: {
  children: ReactNode
  ordered?: boolean
  className?: string
}) {
  const classes = ['divide-y divide-border rounded-xl border border-border', className]
    .filter(Boolean)
    .join(' ')

  return ordered ? <ol className={classes}>{children}</ol> : <ul className={classes}>{children}</ul>
}

export function CardListItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <li className={['p-4', className].filter(Boolean).join(' ')}>{children}</li>
}

/** Message d'état vide : jamais une page blanche, toujours la sortie à prendre. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
      {children}
    </div>
  )
}
