import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/context/ToastContext'
import { clearAuthSession, getAuthToken, getSessionExpiry } from '@/lib/auth'
import { getAuthStatus, signOutEverywhere, type AuthStatus } from '@/services/googleSheetsApi'
import { getErrorMessage } from '@/lib/errors'

const STEPS = [
  { title: 'Choose a passcode', body: 'Apps Script editor → Project Settings → Script Properties → add LUMA_PASSCODE (8+ characters).' },
  { title: 'Create the keys', body: 'Run setupLumaAuth() once. Its log shows your iPhone Shortcut key.' },
  { title: 'Update the iPhone Shortcut', body: 'Add a "key" field with that value to the JSON the Shortcut sends.' },
  { title: 'Deploy a new version', body: 'Protection switches on by itself once the passcode is set. If LUMA_AUTH_ENFORCE = false is in Script Properties, delete it.' },
]

export function SecuritySettings() {
  const { showToast } = useToast()
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const signedIn = !!getAuthToken()
  const sessionEnds = getSessionExpiry()

  useEffect(() => {
    getAuthStatus()
      .then(setStatus)
      .catch(() => setStatusError(true))
  }, [])

  const signOut = () => {
    clearAuthSession()
    window.location.assign('/')
  }

  const signOutAll = async () => {
    setBusy(true)
    try {
      await signOutEverywhere()
      signOut()
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't sign out other devices."), 'error')
      setBusy(false)
      setConfirmAll(false)
    }
  }

  const protectedNow = status?.enforced
  return (
    <Card hoverable className="max-w-2xl">
      <CardHeader title="Security" subtitle="Who can open your ledger" icon={<ShieldCheck size={17} className="text-ink-soft" />} />

      {!status && !statusError ? (
        <Skeleton className="h-16 w-full rounded-card" />
      ) : (
        <div
          className={`flex items-start gap-3 rounded-card border px-4 py-3 ${
            protectedNow ? 'border-success/30 bg-success-soft/50' : 'border-warning/30 bg-warning-soft/50'
          }`}
        >
          {protectedNow ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />}
          <div className="text-xs leading-relaxed text-ink">
            {statusError ? (
              <p>Couldn't check the protection status right now.</p>
            ) : protectedNow ? (
              <>
                <p className="font-semibold">Protected with your passcode</p>
                <p className="text-ink-soft">Every request to your data needs a signed-in session. Your iPhone Shortcut can only add entries.</p>
                {sessionEnds && (
                  <p className="mt-1 text-ink-soft">
                    Sessions last 2 hours. This one ends at{' '}
                    <span className="font-semibold text-ink">{new Date(sessionEnds).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">Not protected yet</p>
                <p className="text-ink-soft">
                  Anyone who has your Apps Script URL can read and change your data. Finish the steps below to require your passcode.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {status && !status.enforced && (
        <ol className="mt-5 space-y-3">
          {STEPS.map((step, i) => {
            const done = i === 0 && status.configured
            return (
              <li key={step.title} className="flex gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono-figure text-[11px] font-bold ${
                    done ? 'bg-success text-paper' : 'bg-bg-soft text-ink-soft'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">{step.title}</p>
                  <p className="text-[11.5px] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {signedIn && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border-soft pt-4">
          <Button variant="secondary" size="sm" icon={<LogOut size={13} />} onClick={signOut}>
            Sign out
          </Button>
          <Button variant="ghost" size="sm" icon={<MonitorSmartphone size={13} />} onClick={() => setConfirmAll(true)}>
            Sign out everywhere
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmAll}
        title="Sign out on every device?"
        description="Every browser and device signed in to Luma — including this one — will need the passcode again. Your iPhone Shortcut keeps working."
        confirmLabel="Sign out everywhere"
        loading={busy}
        loadingLabel="Signing out…"
        onConfirm={() => void signOutAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </Card>
  )
}
