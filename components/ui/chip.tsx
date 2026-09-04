import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Deux objets visuellement proches mais fonctionnellement opposés, d'où deux
 * composants distincts plutôt qu'un `Chip interactive` : `Chip` étiquette une
 * donnée (zone travaillée), `ToggleChip` porte une sélection et doit donc être
 * un vrai bouton, annoncé comme tel avec `aria-pressed`.
 */

type ChipProps = {
  children: ReactNode
  /** Zone primaire d'un exercice : la seule mise en avant prévue par le spec. */
  emphasis?: boolean
  size?: 'sm' | 'md'
}

export function Chip({ children, emphasis = false, size = 'sm' }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1',
        size === 'sm' ? 'text-xs' : 'text-sm',
        emphasis
          ? 'bg-accent font-medium text-accent-foreground'
          : 'border border-border text-foreground',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

type ToggleChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  selected: boolean
  children: ReactNode
}

export function ToggleChip({ selected, children, className = '', ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        'inline-flex min-h-10 items-center rounded-lg border px-3 text-xs transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]',
        selected ? 'border-accent bg-accent font-medium text-accent-foreground' : 'border-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
