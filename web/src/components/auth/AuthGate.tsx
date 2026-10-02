import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Eye, EyeOff, Lock, ScanFace } from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { clearAuthSession, getAuthToken, getSessionExpiry, onAuthRequired, rememberPasscodeRequired, setAuthSession } from '@/lib/auth'
import { devicesSupported, enrollDevice, getAuthStatus, signIn, signInWithDevice } from '@/services/googleSheetsApi'
import { Modal } from '@/components/ui/Modal'
import {
  BiometricUnsupportedError,
  biometricAvailable,
  biometricLabel,
  enrollThisDevice,
  enrolledDevice,
  forgetDevice,
  isBiometricCancel,
  unlockThisDevice,
} from '@/lib/deviceUnlock'
import { cn } from '@/lib/cn'

type GateState = 'signin' | 'ready'

/** The countdown pill appears this long before the session ends. */
const WARN_BEFORE_MS = 5 * 60 * 1000

/**
 * Fail-closed: without a live session nothing but the sign-in screen renders — on any device.
 * A session lasts 2 hours; when it ends (timer, another tab signing out, or the script
 * refusing a request) every cached copy of the data is wiped and the passcode is asked again.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => (getAuthToken() ? 'ready' : 'signin'))
  const [reason, setReason] = useState<'expired' | 'refused' | null>(null)
  // Once the app has rendered in this page, stale in-memory data exists: a later sign-in reloads.
  const appShown = useRef(state === 'ready')
  useEffect(() => {
    if (state === 'ready') appShown.current = true
  }, [state])

  useEffect(
    () =>
      onAuthRequired(() => {
        setReason('refused')
        setState('signin')
      }),
    [],
  )

  // Ends the session on time — also after sleep/background, when timers are late — and follows other tabs.
  useEffect(() => {
    if (state !== 'ready') return
    const check = () => {
      if (getAuthToken()) return
      clearAuthSession()
      setReason('expired')
      setState('signin')
    }
    const expiry = getSessionExpiry()
    const timer = expiry ? window.setTimeout(check, Math.max(0, expiry - Date.now()) + 50) : undefined
    const interval = window.setInterval(check, 15_000)
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'luma:auth:v1') check()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('storage', onStorage)
    check()
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('storage', onStorage)
    }
  }, [state])

  // Signed out: find out whether a passcode is needed at all (a fresh setup has none yet).
  useEffect(() => {
    if (state !== 'signin') return
    let cancelled = false
    getAuthStatus()
      .then((status) => {
        if (cancelled) return
        rememberPasscodeRequired(status.configured)
        if (!status.configured) setState('ready')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [state])

  const onSignedIn = () => {
    if (appShown.current) {
      window.location.reload()
      return
    }
    setReason(null)
    setState('ready')
  }

  if (state === 'ready')
    return (
      <>
        {children}
        <SessionCountdown />
        <BiometricOffer />
      </>
    )
  return <SignInScreen reason={reason} onSignedIn={onSignedIn} />
}

const OFFER_FLAG = 'luma-offer-biometric'
const OFFER_DECLINED = 'lumaui:biometric-offer-declined'

/** Right after a passcode sign-in: "Sign in with Face ID next time?" — once, on supported devices. */
function BiometricOffer() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const label = biometricLabel()

  useEffect(() => {
    let flagged = false
    try {
      flagged = sessionStorage.getItem(OFFER_FLAG) === '1' && !localStorage.getItem(OFFER_DECLINED)
      sessionStorage.removeItem(OFFER_FLAG)
    } catch {
      flagged = false
    }
    if (!flagged || enrolledDevice()) return
    void Promise.all([biometricAvailable(), devicesSupported()]).then(([available, supported]) => {
      if (available && supported) setShow(true)
    })
  }, [])

  const close = (declined: boolean) => {
    if (declined) {
      try {
        localStorage.setItem(OFFER_DECLINED, '1')
      } catch {
        // ignore
      }
    }
    setShow(false)
  }

  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      await enrollThisDevice(enrollDevice)
      setDone(true)
      window.setTimeout(() => close(false), 1600)
    } catch (err) {
      if (!isBiometricCancel(err)) setError(err instanceof Error ? err.message : `Couldn't turn on ${label}.`)
      if (err instanceof BiometricUnsupportedError) window.setTimeout(() => close(true), 3500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={show} onClose={() => close(true)} busy={busy} title={done ? `${label} is on` : `Sign in with ${label} next time?`}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rust/10 text-rust">
          <ScanFace size={26} />
        </span>
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-soft">
          {done
            ? `Next time, unlock Luma on this device with ${label} instead of typing your passcode.`
            : `Skip the passcode on this device. Your face or fingerprint never leaves this device — Luma only keeps a key that ${label} unlocks.`}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[11.5px] text-danger">
            {error}
          </p>
        )}
        {!done && (
          <div className="mt-5 flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => close(true)} disabled={busy}>
              Not now
            </Button>
            <Button className="flex-1" icon={<ScanFace size={14} />} loading={busy} loadingText="Setting up…" onClick={() => void turnOn()}>
              Turn on
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** A small pill in the last minutes of the session, so the sign-out never comes as a surprise. */
function SessionCountdown() {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const expiry = getSessionExpiry()
      setLeft(expiry ? expiry - Date.now() : null)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const show = left !== null && left > 0 && left <= WARN_BEFORE_MS
  const minutes = Math.floor((left ?? 0) / 60000)
  const seconds = Math.floor(((left ?? 0) % 60000) / 1000)
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warning/30 bg-card px-3.5 py-2 text-[11.5px] text-ink shadow-hover"
        >
          <Clock size={13} className="text-warning" />
          Session ends in{' '}
          <span className="font-mono-figure font-semibold">
            {minutes}:{String(seconds).padStart(2, '0')}
          </span>{' '}
          — save what you're working on.
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SignInScreen({ reason, onSignedIn }: { reason: 'expired' | 'refused' | null; onSignedIn: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState(() => enrolledDevice())
  const [deviceReady, setDeviceReady] = useState(false)
  const [deviceBusy, setDeviceBusy] = useState(false)
  const label = biometricLabel()
  const showDevice = !!device && deviceReady

  useEffect(() => {
    if (!device) return
    void devicesSupported().then(setDeviceReady)
  }, [device])

  const unlockWithDevice = async () => {
    if (deviceBusy || busy) return
    setDeviceBusy(true)
    setError(null)
    try {
      const { deviceId, secret } = await unlockThisDevice()
      const { token, expiresAt } = await signInWithDevice(deviceId, secret)
      clearAuthSession()
      setAuthSession(token, expiresAt)
      onSignedIn()
    } catch (err) {
      if (!isBiometricCancel(err)) {
        if (err && typeof err === 'object' && 'revoked' in err && err.revoked) {
          forgetDevice()
          setDevice(null)
          setError(`${label} sign-in was turned off for this device. Use your passcode.`)
        } else {
          setError(err instanceof Error ? err.message : `Couldn't unlock with ${label}.`)
        }
      }
      setDeviceBusy(false)
    }
  }

  useEffect(() => {
    if (!busy) return
    const id = window.setTimeout(() => setSlow(true), 4000)
    return () => {
      window.clearTimeout(id)
      setSlow(false)
    }
  }, [busy])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!passcode || busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, expiresAt } = await signIn(passcode)
      // Start clean: nothing from an earlier session survives, then load with the new one.
      clearAuthSession()
      setAuthSession(token, expiresAt)
      setPasscode('')
      try {
        sessionStorage.setItem(OFFER_FLAG, '1')
      } catch {
        // no offer this time
      }
      onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.")
      setBusy(false)
    }
  }

  const title = reason === 'expired' ? 'Session ended' : reason === 'refused' ? 'Please sign in again' : 'Welcome back'
  const subtitle =
    reason === 'expired'
      ? 'For your safety Luma signs out after 2 hours. Enter your passcode to continue.'
      : 'Enter your passcode to open your ledger.'

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
        <h1 className="mt-5 font-display text-2xl italic text-ink">{title}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{subtitle}</p>

        {showDevice && (
          <>
            <Button type="button" size="lg" className="mt-6 w-full" icon={<ScanFace size={17} />} loading={deviceBusy} loadingText="Unlocking…" onClick={() => void unlockWithDevice()}>
              Unlock with {label}
            </Button>
            <div className="mt-5 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
              <span className="h-px flex-1 bg-border-soft" />
              or use your passcode
              <span className="h-px flex-1 bg-border-soft" />
            </div>
          </>
        )}

        <label htmlFor="passcode" className={cn('mb-1.5 block text-xs font-medium text-ink-soft', showDevice ? 'mt-4' : 'mt-6')}>
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
            autoFocus={!device}
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

        <Button type="submit" size="lg" variant={showDevice ? 'secondary' : 'primary'} className="mt-6 w-full" loading={busy} loadingText={slow ? 'Google is slow, still checking…' : 'Checking…'} disabled={!passcode}>
          Sign in
        </Button>

        <p className="mt-6 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-muted">
          <Lock size={11} className="mt-0.5 shrink-0" />
          Checked by your own Google Apps Script and never stored. You stay signed in for 2 hours on this device, then Luma locks
          itself and clears its copy of your data.
        </p>
      </motion.form>
    </div>
  )
}
