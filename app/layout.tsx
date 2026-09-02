import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Gokaku',
  description: 'Séances de mobilité et étirements',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pas de zoom : l'écran d'exécution se pilote au pouce, un pincement accidentel
  // pendant une séance est une friction.
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
