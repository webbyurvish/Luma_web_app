import { type FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CloudOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { LedgerLoader } from '@/components/ui/Loader'
import { SecretInput } from './SecretInput'
import { loadVault, setupVault, unlockVault, type VaultPhase } from '@/hooks/useVault'
import { getErrorMessage } from '@/lib/errors'
import { passwordStrength } from '@/lib/vaultMeta'

const MIN_MASTER = 10

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-1 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-hero border border-border bg-card px-6 py-7 shadow-hover sm:px-8"
      >
        {children}
      </motion.div>
    </div>
  )
}

/** Everything the vault shows before it's unlocked: loading, errors, first-time setup, unlock. */
export function VaultGate({ phase, error, onForgot }: { phase: VaultPhase; error: string | null; onForgot: () => void }) {
  if (phase === 'loading') return <LedgerLoader label="Opening your vault…" hint="Fetching encrypted items" className="min-h-[50vh] justify-center" />
  if (phase === 'error') return <ErrorState title="Couldn't open the vault" description={error ?? undefined} onRetry={() => void loadVault(true)} />
  if (phase === 'unavailable')
    return (
      <Shell>
        <CloudOff size={26} className="text-ink-muted" />
        <h2 className="mt-4 font-display text-xl italic text-ink">One step left</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          The vault needs the latest Apps Script. Run <code className="rounded bg-bg-soft px-1">clasp push</code>, deploy a new version, then reload
          this page.
        </p>
        <Button className="mt-5" variant="secondary" size="sm" onClick={() => void loadVault(true)}>
          Check again
        </Button>
      </Shell>
    )
  if (phase === 'setup') return <SetupForm />
  return <UnlockForm onForgot={onForgot} />
}

function SetupForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = passwordStrength(password)
  const errors = {
    password: password.length < MIN_MASTER ? `Use at least ${MIN_MASTER} characters.` : strength.score < 2 ? 'Too easy to guess — mix words, numbers and symbols.' : '',
    confirm: confirm !== password ? "The two passwords don't match." : '',
    understood: understood ? '' : 'Please confirm you understand.',
  }
  const valid = !errors.password && !errors.confirm && !errors.understood

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await setupVault(password)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the vault."))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form onSubmit={submit} noValidate>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rust/10 text-rust">
          <ShieldCheck size={22} />
        </span>
        <h2 className="mt-4 font-display text-2xl italic text-ink">Create your vault</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          Passwords, cards, bank details and IDs — encrypted on this device with a master password before anything is saved. Google and the sheet
          only ever hold unreadable ciphertext.
        </p>

        <label htmlFor="vault-new" className="mb-1.5 mt-6 block text-xs font-medium text-ink-soft">
          Master password
        </label>
        <SecretInput id="vault-new" value={password} onChange={setPassword} meter autoFocus autoComplete="new-password" invalid={attempted && !!errors.password} />
        {attempted && errors.password && <p className="mt-1 text-[11px] text-danger">{errors.password}</p>}

        <label htmlFor="vault-confirm" className="mb-1.5 mt-4 block text-xs font-medium text-ink-soft">
          Type it again
        </label>
        <SecretInput id="vault-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={attempted && !!errors.confirm} />
        {attempted && errors.confirm && <p className="mt-1 text-[11px] text-danger">{errors.confirm}</p>}

        <div className="mt-5 flex gap-2.5 rounded-card border border-warning/30 bg-warning-soft/50 px-3.5 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
          <label className="cursor-pointer text-[11.5px] leading-relaxed text-ink">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mr-2 h-3.5 w-3.5 align-[-2px] accent-rust" />
            I understand nobody — not even Luma — can recover this password. If I forget it, the vault can only be erased and started again.
          </label>
        </div>
        {attempted && errors.understood && <p className="mt-1 text-[11px] text-danger">{errors.understood}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">Tip: use something different from your Luma passcode, like a short sentence only you would think of.</p>

        {error && (
          <p role="alert" className="mt-3 text-[11.5px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} loadingText="Creating secure vault…">
          Create vault
        </Button>
      </form>
    </Shell>
  )
}

function UnlockForm({ onForgot }: { onForgot: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await unlockVault(password)
      if (!ok) {
        setError("That master password isn't right.")
        setBusy(false)
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't unlock the vault."))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <form onSubmit={submit}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rust/10 text-rust">
          <LockKeyhole size={21} />
        </span>
        <h2 className="mt-4 font-display text-2xl italic text-ink">Vault locked</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">Enter your master password. It locks again after 5 minutes without activity.</p>

        <label htmlFor="vault-unlock" className="mb-1.5 mt-6 block text-xs font-medium text-ink-soft">
          Master password
        </label>
        <SecretInput id="vault-unlock" value={password} onChange={setPassword} autoFocus autoComplete="current-password" invalid={!!error} disabled={busy} />
        {error && (
          <p role="alert" className="mt-1.5 text-[11.5px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} loadingText="Decrypting…" disabled={!password}>
          Unlock
        </Button>
        <button type="button" onClick={onForgot} className="mt-4 w-full text-center text-[11px] text-ink-muted underline-offset-2 hover:text-ink hover:underline">
          Forgot the master password?
        </button>
      </form>
    </Shell>
  )
}
