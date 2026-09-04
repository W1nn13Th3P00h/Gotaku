import type { ButtonHTMLAttributes } from 'react'

/**
 * Socle unique des éléments tapables. `buttonClasses` existe séparément du
 * composant parce que la moitié des actions de l'app sont des `<Link>` Next :
 * un composant seul aurait imposé de recopier les classes à côté, ce qui est
 * exactement la dette que cette couche supprime.
 *
 * Toutes les tailles tiennent la cible tactile de 44 px recommandée sur iOS,
 * sauf `chip` (40 px), réservée aux grilles de sélection où 44 px rendrait la
 * liste des zones du générateur ingérable au pouce.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'quiet'
export type ButtonSize = 'lg' | 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[opacity,background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-foreground',
  secondary: 'border border-border',
  // Plein sans contour : distingue une action d'une case à cocher, dont le
  // contour vide signale précisément « non sélectionné ».
  subtle: 'bg-subtle text-foreground',
  quiet: 'text-muted underline underline-offset-2',
}

const SIZES: Record<ButtonSize, string> = {
  lg: 'min-h-14 px-5 text-base',
  md: 'min-h-11 px-4 text-sm',
  sm: 'min-h-11 px-3 text-xs',
}

export type ButtonStyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Pleine largeur : le cas dominant des écrans mobiles de l'app. */
  block?: boolean
  className?: string
}

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  block = false,
  className = '',
}: ButtonStyleProps = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], block ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ')
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps

export function Button({ variant, size, block, className, type = 'button', ...rest }: Props) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest} />
}
