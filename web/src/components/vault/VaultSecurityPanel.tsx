import { useMemo, useState } from 'react'
import { AlertTriangle, Fingerprint, KeyRound, Lock, Recycle, ScanFace, ShieldAlert, ShieldCheck, Timer } from 'lucide-react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Chips } from '@/components/life/FormBits'
import { SecretInput } from './SecretInput'
import { useToast } from '@/context/ToastContext'
import {
  enableVaultBiometric,
  forgetVaultBiometric,
  setVaultLockPrefs,
  useVault,
  useVaultLockPrefs,
  vaultBiometricStatus,
  vaultKdfLabel,
  type VaultOnLeave,
} from '@/hooks/useVault'
import { analyseHealth, checkBreaches, vaultSecrets, type HealthEntry, type Issue } from '@/lib/vaultHealth'
import { biometricLabel, enrolledDevice, isBiometricCancel } from '@/lib/deviceUnlock'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'

const ISSUE: Record<Issue, { label: string; tone: string }> = {
  breached: { label: 'In a data breach', tone: 'bg-danger-soft text-danger' },
  reused: { label: 'Reused', tone: 'bg-warning-soft text-ink' },
  weak: { label: 'Weak', tone: 'bg-warning-soft text-ink' },
  old: { label: 'Over a year old', tone: 'bg-bg-soft text-ink-soft' },
}

export function VaultSecurityPanel({ open, onClose, onChangeMaster, onOpenItem }: { open: boolean; onClose: () => void; onChangeMaster: () => void; onOpenItem: (id: string) => void }) {
  const { showToast } = useToast()
  const vault = useVault()
  const prefs = useVaultLockPrefs()
  const bio = vaultBiometricStatus()
  const faceId = biometricLabel()
  const [askPassword, setAskPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState('')
  const [breaches, setBreaches] = useState<Map<string, number> | null>(null)
  const [checking, setChecking] = useState('')
  const [, rerender] = useState(0)

  const health = useMemo<HealthEntry[]>(() => analyseHealth(vault.items, breaches ?? undefined), [vault.items, breaches])
  const total = vaultSecrets(vault.items).length
  const counts = (['breached', 'reused', 'weak', 'old'] as Issue[]).map((i) => [i, health.filter((h) => h.issues.includes(i)).length] as const)

  const turnOn = async () => {
    setBioBusy(true)
    setBioError('')
    try {
      const ok = await enableVaultBiometric(password)
      if (!ok) setBioError("That master password isn't right.")
      else {
        setAskPassword(false)
        setPassword('')
        showToast(`${faceId} can now unlock the vault on this device`)
      }
    } catch (err) {
      if (!isBiometricCancel(err)) setBioError(getErrorMessage(err, `Couldn't set up ${faceId}.`))
    } finally {
      setBioBusy(false)
      rerender((n) => n + 1)
    }
  }

  const runBreachCheck = async () => {
    setChecking('Checking…')
    try {
      const found = await checkBreaches(
        vaultSecrets(vault.items).map((s) => s.value),
        (d, t) => setChecking(`Checking… ${d} of ${t}`),
      )
      setBreaches(found)
      const hits = [...found.values()].filter((n) => n > 0).length
      showToast(hits ? `${hits} password${hits === 1 ? '' : 's'} found in known breaches — change ${hits === 1 ? 'it' : 'them'}` : 'None of your passwords are in known breaches', hits ? 'error' : 'success')
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't run the breach check."), 'error')
    } finally {
      setChecking('')
    }
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Vault security" subtitle="Encryption, unlocking, auto-lock and password health" className="sm:w-[520px]">
      <div className="space-y-5">
        {/* Encryption */}
        <section className="rounded-md border border-border-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <ShieldCheck size={14} className="text-success" /> Encrypted on this device
          </p>
          <ul className="mt-2 space-y-1 text-[11.5px] leading-snug text-ink-soft">
            <li>AES-256-GCM; your Google Sheet only ever holds scrambled text.</li>
            <li>Key from your master password: {vaultKdfLabel()}.</li>
            <li>The master password is never sent or stored anywhere.</li>
          </ul>
        </section>

        {/* Face ID */}
        <section className="rounded-md border border-border-soft p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                {faceId === 'Face ID' ? <ScanFace size={14} /> : <Fingerprint size={14} />} Unlock with {faceId}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                {bio === 'unavailable'
                  ? !enrolledDevice()
                    ? `Turn on ${faceId} sign-in for this device first (Settings → Security).`
                    : 'Unlock once with your master password — that upgrades the vault’s encryption, then this can be turned on.'
                  : `Only this device, and only after ${faceId}. The key is kept here encrypted; your master password still works everywhere.`}
              </p>
            </div>
            <Switch
              checked={bio === 'on'}
              disabled={bio === 'unavailable' || bioBusy}
              label={`Unlock with ${faceId}`}
              onChange={(on) => {
                if (on) setAskPassword(true)
                else {
                  forgetVaultBiometric()
                  rerender((n) => n + 1)
                  showToast(`${faceId} unlock turned off`)
                }
              }}
            />
          </div>
          {askPassword && bio === 'off' && (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (password) void turnOn()
              }}
            >
              <p className="text-[11px] text-ink-soft">Confirm your master password once:</p>
              <SecretInput id="vault-bio-password" value={password} onChange={setPassword} autoFocus autoComplete="current-password" invalid={!!bioError} disabled={bioBusy} />
              {bioError && <p className="text-[11px] text-danger">{bioError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => (setAskPassword(false), setPassword(''), setBioError(''))}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={bioBusy} loadingText="Setting up…" disabled={!password}>
                  Turn on
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Auto-lock */}
        <section className="space-y-3 rounded-md border border-border-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Timer size={14} /> Auto-lock
          </p>
          <div>
            <p className="mb-1.5 text-[11px] text-ink-soft">When you leave Luma or the screen locks</p>
            <Chips
              value={prefs.onLeave}
              options={['now', '1min', 'off'] as VaultOnLeave[]}
              labels={{ now: 'Lock immediately', '1min': 'After 1 minute away', off: 'Only when idle' }}
              onChange={(v) => setVaultLockPrefs({ onLeave: v })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] text-ink-soft">After no taps for</p>
            <Chips value={String(prefs.idleMinutes)} options={['1', '5', '15']} labels={{ '1': '1 minute', '5': '5 minutes', '15': '15 minutes' }} onChange={(v) => setVaultLockPrefs({ idleMinutes: Number(v) as 1 | 5 | 15 })} />
          </div>
          {bio !== 'on' && prefs.onLeave === 'now' && <p className="text-[10.5px] text-ink-muted">Tip: turn on {faceId} unlock so locking immediately doesn't mean typing the master password each time.</p>}
        </section>

        {/* Master password */}
        <section className="flex items-center justify-between gap-3 rounded-md border border-border-soft p-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <KeyRound size={14} /> Master password
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">Can't be recovered if forgotten — keep a paper copy somewhere safe.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onChangeMaster}>
            Change
          </Button>
        </section>

        {/* Password health */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ShieldAlert size={15} className="text-rust" /> Password health
            </p>
            <p className="text-[11px] text-ink-muted">
              {total} password{total === 1 ? '' : 's'} checked
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {counts.map(([issue, n]) => (
              <div key={issue} className={cn('rounded-md px-2 py-2 text-center', n ? ISSUE[issue].tone : 'bg-bg-soft text-ink-muted')}>
                <p className="font-mono-figure text-base font-semibold">{issue === 'breached' && !breaches ? '–' : n}</p>
                <p className="text-[9.5px] font-semibold uppercase leading-tight tracking-[0.04em]">{ISSUE[issue].label.replace('In a data breach', 'Breached').replace('Over a year old', 'Old')}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-bg-soft p-3">
            <Button size="sm" variant="secondary" icon={<AlertTriangle size={13} />} loading={!!checking} loadingText={checking} disabled={!total} onClick={() => void runBreachCheck()}>
              {breaches ? 'Check again for breaches' : 'Check for breaches'}
            </Button>
            <p className="mt-2 text-[10.5px] leading-snug text-ink-muted">
              Uses Have I Been Pwned. Your passwords never leave this phone — only the first 5 characters of a scrambled fingerprint are sent, the same way 1Password and Bitwarden check.
            </p>
          </div>
          {health.length === 0 ? (
            <p className="flex items-center gap-1.5 py-3 text-xs text-success">
              <Lock size={13} /> {total ? 'No problems found.' : 'No passwords saved yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-soft rounded-md border border-border-soft">
              {health.map((h) => (
                <li key={`${h.itemId}-${h.field}`}>
                  <button type="button" onClick={() => onOpenItem(h.itemId)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-soft/60">
                    {h.issues.includes('reused') ? <Recycle size={14} className="shrink-0 text-ink-muted" /> : <KeyRound size={14} className="shrink-0 text-ink-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{h.title}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {h.issues.map((i) => (
                          <span key={i} className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', ISSUE[i].tone)}>
                            {i === 'breached' && h.breachCount ? `Breached ${h.breachCount.toLocaleString('en-IN')}×` : ISSUE[i].label}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SlideOver>
  )
}
