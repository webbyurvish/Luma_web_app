import { type FormEvent, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SecretInput } from './SecretInput'
import { useToast } from '@/context/ToastContext'
import { changeMasterPassword, resetVault } from '@/hooks/useVault'
import { getErrorMessage } from '@/lib/errors'
import { passwordStrength } from '@/lib/vaultMeta'

export function ChangeMasterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
  }, [open])

  const problem =
    next.length < 10 ? 'Use at least 10 characters.' : passwordStrength(next).score < 2 ? 'Too easy to guess.' : confirm !== next ? "The new passwords don't match." : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!current || problem || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await changeMasterPassword(current, next)
      if (!ok) {
        setError("The current master password isn't right.")
      } else {
        showToast('Master password changed — every item was re-encrypted')
        onClose()
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't change the master password."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Change master password" subtitle="Every item is re-encrypted with the new one">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="vm-current" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Current master password
          </label>
          <SecretInput id="vm-current" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </div>
        <div>
          <label htmlFor="vm-next" className="mb-1.5 block text-xs font-medium text-ink-soft">
            New master password
          </label>
          <SecretInput id="vm-next" value={next} onChange={setNext} meter autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="vm-confirm" className="mb-1.5 block text-xs font-medium text-ink-soft">
            New password again
          </label>
          <SecretInput id="vm-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {next && problem && <p className="mt-1 text-[11px] text-ink-muted">{problem}</p>}
        </div>
        {error && (
          <p role="alert" className="text-[11.5px] text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={busy} loadingText="Re-encrypting…" disabled={!current || !!problem}>
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const ERASE_WORD = 'ERASE VAULT'

export function ResetVaultDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTyped('')
      setError(null)
    }
  }, [open])

  const erase = async () => {
    setBusy(true)
    setError(null)
    try {
      await resetVault()
      showToast('Vault erased — create a new master password to start again')
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't erase the vault."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Forgot the master password?" subtitle="It can't be recovered — that's what keeps the vault safe">
      <div className="flex gap-2.5 rounded-card border border-danger/30 bg-danger-soft px-3.5 py-3 text-[11.5px] leading-relaxed text-ink">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
        <p>
          The only way forward is to <strong>erase every item in the vault</strong> and set a new master password. Nothing else in Luma is touched. This
          can't be undone.
        </p>
      </div>
      <label htmlFor="vault-erase" className="mb-1.5 mt-4 block text-xs font-medium text-ink-soft">
        Type <span className="font-mono-figure font-semibold text-ink">{ERASE_WORD}</span> to confirm
      </label>
      <Input id="vault-erase" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          Keep trying
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={() => void erase()} loading={busy} loadingText="Erasing…" disabled={typed.trim().toUpperCase() !== ERASE_WORD}>
          Erase vault
        </Button>
      </div>
    </Modal>
  )
}
