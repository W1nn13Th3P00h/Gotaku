import type { MetadataRoute } from 'next'

/**
 * Manifest natif Next.js (`MetadataRoute.Manifest`), sans dépendance PWA tierce
 * (voir `research.md` § Manifest et service worker). Icônes minimales : un
 * monogramme suffit à ce stade (Assumptions de `spec.md`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gokaku',
    short_name: 'Gokaku',
    description: 'Séances de mobilité et étirements',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
