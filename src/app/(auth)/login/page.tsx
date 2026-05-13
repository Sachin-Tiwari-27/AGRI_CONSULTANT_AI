import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-36 rounded bg-slate-200" />
      <div className="h-4 w-64 rounded bg-slate-100" />
      <div className="h-11 rounded-lg bg-slate-100" />
      <div className="h-10 rounded-lg bg-slate-100" />
      <div className="h-10 rounded-lg bg-slate-100" />
    </div>
  )
}
