import { useCallback, useEffect, useState } from 'react'
import { ScanFace, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/context/ToastContext'
import { devicesSupported, enrollDevice, listDevices, revokeDevice, type RegisteredDevice } from '@/services/googleSheetsApi'
import { biometricAvailable, biometricLabel, enrollThisDevice, enrolledDevice, forgetDevice, isBiometricCancel } from '@/lib/deviceUnlock'
import { formatRelativeDate } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'

/** Face ID / fingerprint sign-in: this device on/off, plus every device that has it. */
export function BiometricSettings() {
  const { showToast } = useToast()
  const label = biometricLabel()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [available, setAvailable] = useState(false)
  const [devices, setDevices] = useState<RegisteredDevice[] | null>(null)
  const [mine, setMine] = useState(() => enrolledDevice())
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ok, here] = await Promise.all([devicesSupported(), biometricAvailable()])
    setSupported(ok)
    setAvailable(here)
    if (!ok) return
    try {
      const list = await listDevices()
      setDevices(list)
      // Removed elsewhere (or "sign out everywhere"): forget the local setup too.
      const local = enrolledDevice()
      if (local && !list.some((d) => d.id === local.deviceId)) {
        forgetDevice()
        setMine(null)
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't load your devices."), 'error')
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const turnOn = async () => {
    setBusy('enroll')
    try {
      await enrollThisDevice(enrollDevice)
      setMine(enrolledDevice())
      showToast(`${label} sign-in is on for this device`)
      await load()
    } catch (err) {
      if (!isBiometricCancel(err)) showToast(getErrorMessage(err, `Couldn't turn on ${label}.`), 'error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (id: string) => {
    setBusy(id)
    try {
      await revokeDevice(id)
      if (mine?.deviceId === id) {
        forgetDevice()
        setMine(null)
      }
      showToast('Device removed — it needs the passcode again')
      await load()
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't remove the device."), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card hoverable className="max-w-2xl">
      <CardHeader title={`${label} sign-in`} subtitle="Unlock Luma without typing the passcode" icon={<ScanFace size={17} className="text-ink-soft" />} />
      {supported === null ? (
        <Skeleton className="h-16 w-full rounded-card" />
      ) : !supported ? (
        <p className="text-xs text-ink-soft">Deploy the latest Apps Script version to use {label} sign-in.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-card border border-border-soft bg-bg-soft/40 px-4 py-3">
            <div className="text-xs">
              <p className="font-semibold text-ink">This device</p>
              <p className="mt-0.5 leading-relaxed text-ink-soft">
                {mine
                  ? `On — sign in here with ${label}. Sessions still end after 2 hours.`
                  : available
                    ? `Off — turn on to sign in with ${label} instead of the passcode. Needs iOS 18 or a recent browser.`
                    : 'This browser has no built-in Face ID or fingerprint support.'}
              </p>
            </div>
            {mine ? (
              <Button size="sm" variant="secondary" loading={busy === mine.deviceId} onClick={() => void remove(mine.deviceId)}>
                Turn off
              </Button>
            ) : (
              available && (
                <Button size="sm" icon={<ScanFace size={13} />} loading={busy === 'enroll'} loadingText="Setting up…" onClick={() => void turnOn()}>
                  Turn on
                </Button>
              )
            )}
          </div>

          {devices && devices.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Devices that can sign in this way</p>
              <ul className="divide-y divide-border-soft rounded-card border border-border-soft">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-medium text-ink">
                        {d.name}
                        {mine?.deviceId === d.id && <span className="ml-1.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-success">This device</span>}
                      </p>
                      <p className="text-[10.5px] text-ink-muted">Last used {formatRelativeDate(d.lastUsedAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(d.id)}
                      disabled={busy === d.id}
                      aria-label={`Remove ${d.name}`}
                      className="rounded-full p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10.5px] leading-relaxed text-ink-muted">
            Your face or fingerprint never leaves the device. Luma keeps a key that only {label} can unlock; “Sign out everywhere” removes every device at once.
          </p>
        </div>
      )}
    </Card>
  )
}
