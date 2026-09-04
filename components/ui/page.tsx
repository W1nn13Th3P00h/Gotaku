import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Gabarits de page. Deux seulement, parce que l'app n'a que deux situations :
 * un écran qui défile (`scroll`) et un écran de décision centré sur un seul
 * message (`centered` : connexion, échec de génération, départ et fin de séance).
 */

type PageProps = {
  children: ReactNode
  layout?: 'scroll' | 'centered'
  className?: string
}

export function Page({ children, layout = 'scroll', className = '' }: PageProps) {
  const base =
    layout === 'centered'
      ? 'mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6'
      : 'mx-auto max-w-md p-6 pb-16'

  return <main className={[base, className].filter(Boolean).join(' ')}>{children}</main>
}

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Actions secondaires alignées à droite du titre (liens de navigation courts). */
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </header>
  )
}

/**
 * Cible tactile pleine hauteur : un lien de retour de 16 px de haut est le
 * premier élément raté au pouce, et c'est le plus fréquemment utilisé.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm text-accent transition-opacity duration-150 active:opacity-70"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  )
}

type SectionProps = {
  title?: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, description, action, children, className = '' }: SectionProps) {
  return (
    <section className={className}>
      {title ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {action}
        </div>
      ) : null}
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  )
}
