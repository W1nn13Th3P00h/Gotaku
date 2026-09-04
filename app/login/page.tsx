import { Suspense } from 'react'

import { LoginForm } from '@/app/login/login-form'
import { Page, PageHeader } from '@/components/ui/page'

export const metadata = { title: 'Connexion — Gokaku' }

export default function LoginPage() {
  return (
    <Page layout="centered" className="gap-8">
      <PageHeader
        title="Gokaku"
        subtitle="Application personnelle. Le compte se crée dans Supabase, pas ici."
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </Page>
  )
}
