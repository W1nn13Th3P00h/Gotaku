import type { ReactNode } from 'react'

/**
 * Barre d'action ancrée en bas de fenêtre. Le générateur et la composition font
 * plusieurs écrans de haut : leur action de sortie ne peut pas dépendre d'un
 * défilement jusqu'au pied de page.
 *
 * `position: fixed` se cale sur le viewport, donc en dehors du `padding` de
 * sécurité posé sur `body` : le décalage iOS est repris ici explicitement.
 * Prévoir un `pb-32` sur la page pour que le dernier contenu ne passe pas
 * dessous.
 */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
      <div
        className="mx-auto max-w-md px-6 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>
  )
}
