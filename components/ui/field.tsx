import type { ReactNode } from 'react'

/**
 * Champs de formulaire. `text-base` sur tout contrôle saisissable est
 * volontaire : en dessous de 16 px, Safari iOS zoome à la prise de focus, et le
 * zoom est désactivé au niveau du viewport — l'utilisateur resterait coincé.
 */

export const inputClasses =
  'w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent'

export const selectClasses = inputClasses

type FieldProps = {
  label: ReactNode
  children: ReactNode
  hint?: ReactNode
  /** Libellé et contrôle sur une même ligne (heure, interrupteur). */
  inline?: boolean
}

export function Field({ label, children, hint, inline = false }: FieldProps) {
  return (
    <label
      className={
        inline
          ? 'flex min-h-11 items-center justify-between gap-3 text-sm'
          : 'flex flex-col gap-1.5 text-sm'
      }
    >
      <span className={inline ? '' : 'font-medium'}>{label}</span>
      {children}
      {hint && !inline ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

/**
 * Retour de formulaire. `role="alert"` sur l'erreur seulement : un succès
 * annoncé de force interromprait la lecture en cours sans rien apporter.
 */
export function FormMessage({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return kind === 'error' ? (
    <p className="text-sm text-danger" role="alert">
      {children}
    </p>
  ) : (
    <p className="text-sm text-muted">{children}</p>
  )
}
