import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../lib/api'
import { dashboardPathForRole } from '../lib/roleDashboard'
import { useAuthStore } from '../store/auth'

export async function clearCachedAccountData(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries()
  queryClient.clear()
}

export function ConnectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const setSession = useAuthStore((state) => state.setSession)
  const user = useAuthStore((state) => state.user)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => {
    if (user) navigate(dashboardPathForRole(user.role), { replace: true })
  }, [navigate, user])

  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: async (session) => {
      await clearCachedAccountData(queryClient)
      setSession(session.access, session.user, session.refresh)
      navigate(dashboardPathForRole(session.user.role), { replace: true })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />         Back to home
        </Link>
        <section className="rounded-xl border border-black/[0.06] bg-white p-7 shadow-panel sm:p-9">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-lg bg-mint text-forest">
            <Activity size={23} aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase text-forest">MediConnect</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Sign in to MediConnect</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Access the dashboard and tools for your role.
          </p>

          {(location.state as { registered?: boolean } | null)?.registered && (
            <p role="status" className="mt-4 rounded-md bg-[#eaf3ee] px-3 py-2.5 text-sm text-[#28664e]">
              Account created. Sign in to continue.
            </p>
          )}
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block text-sm font-medium text-ink">
              Email address
              <input
                autoComplete="username"
                className="mt-2 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none transition placeholder:text-[#9aa59f] focus:border-forest focus:ring-2 focus:ring-forest/10"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Password
              <input
                autoComplete="current-password"
                className="mt-2 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none transition placeholder:text-[#9aa59f] focus:border-forest focus:ring-2 focus:ring-forest/10"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {mutation.isError && (
              <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">
                Sign-in failed. Check your credentials and confirm the API is available.
              </p>
            )}
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white transition hover:bg-[#164333] disabled:cursor-wait disabled:opacity-70"
              disabled={mutation.isPending || !email.trim() || !password}
              type="submit"
            >
              <LockKeyhole size={16} aria-hidden="true" />
              {mutation.isPending ? 'Connecting…' : 'Sign in securely'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            New to MediConnect? <Link to="/register" className="font-semibold text-forest hover:underline">Create an account</Link>
          </p>

          <div className="mt-6 flex gap-3 border-t border-black/[0.06] pt-5 text-xs leading-5 text-muted">
            <ShieldCheck className="mt-0.5 shrink-0 text-forest" size={16} aria-hidden="true" />
            <p>Your access and refresh tokens stay in memory for this browser session and are not written to local storage.</p>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted">API: {import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}</p>
      </div>
    </main>
  )
}