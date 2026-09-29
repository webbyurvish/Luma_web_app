import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { clearAuthSession, getAuthToken, onAuthRequired, passcodeKnownRequired, rememberPasscodeRequired, setAuthSession } from '@/lib/auth'
import { getAuthStatus, signIn } from '@/services/googleSheetsApi'
import { cn } from '@/lib/cn'

type GateState = 'signin' | 'ready'

/**
 * Shows the app only to a signed-in user once a passcode is set up in Apps Script — without
 * ever blocking on Google to decide:
 * - Has a session → the app opens at once; if the script refuses it, we drop to sign-in.
 * - A passcode was required last time → sign-in straight away.
 * - Otherwise the app opens and checks in the background; if a passcode is (now) required,
 *   the first refused request — or the background check — switches to sign-in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => (!getAuthToken() && passcodeKnownRequired() ? 'signin' : 'ready'))
  const [expired, setExpired] = useState(false)

  useEffect(
    () =>
      onAuthRequired(() => {
        rememberPasscodeRequired(true)
        setExpired(true)
        setState('signin')
      }),
    [],
  )

  // Background check (read-only). Keeps the remembered answer current.
  useEffect(() => {
    let cancelled = false
    getAuthStatus()
      .then((status) => {
        if (cancelled) return
        rememberPasscodeRequired(status.configured)
        if (status.configured && !getAuthToken()) setState('signin')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'ready') return <>{children}</>
  return <SignInScreen expired={expired} />
}

function SignInScreen({ expired }: { expired: boolean }) {
  const [passcode, setPasscode] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!passcode || busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, expiresAt } = await signIn(passcode, remember)
      // Start clean: drop anything cached by a previous session, then load everything with the new one.
      clearAuthSession()
      setAuthSession(token, expiresAt)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.")
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-hero border border-border bg-card px-7 py-8 shadow-hover"
      >
        <LogoMark size={40} />
        <h1 className="mt-5 font-display text-2xl italic text-ink">{expired ? 'Please sign in again' : 'Welcome back'}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          {expired ? 'Your session ended. Enter your passcode to open your ledger.' : 'Enter your passcode to open your ledger.'}
        </p>

        <label htmlFor="passcode" className="mt-6 mb-1.5 block text-xs font-medium text-ink-soft">
          Passcode
        </label>
        <div
          className={cn(
            'flex items-center rounded-btn border bg-surface pr-1 transition-colors focus-within:border-rust',
            error ? 'border-danger' : 'border-border',
          )}
        >
          <input
            id="passcode"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            disabled={busy}
            aria-invalid={!!error}
            aria-describedby={error ? 'passcode-error' : undefined}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide passcode' : 'Show passcode'}
            className="rounded-full p-2 text-ink-muted transition-colors hover:text-ink"
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {error && (
          <p id="passcode-error" role="alert" className="mt-2 text-[11.5px] text-danger">
            {error}
          </p>
        )}

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 accent-rust" />
          Keep me signed in on this device for 30 days
        </label>

        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} loadingText="Checking…" disabled={!passcode}>
          Sign in
        </Button>

        <p className="mt-6 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-muted">
          <Lock size={11} className="mt-0.5 shrink-0" />
          Your passcode is checked by your own Google Apps Script and is never stored in this browser.
        </p>
      </motion.form>
    </div>
  )
}
