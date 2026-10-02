import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarHeart, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { DeleteRecordDialog } from '@/components/ui/DeleteRecordDialog'
import { RowActions } from '@/components/ui/RowActions'
import { Avatar } from '@/components/ui/Avatar'
import { useImportantDates } from '@/hooks/useFamily'
import { useToast } from '@/context/ToastContext'
import { OCCASIONS, OCCASION_NAMES, countLabel, dateTitle, nextOccurrence } from '@/lib/family'
import { MONTH_ABBR, todayIstDateKey } from '@/lib/formatDate'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/cn'
import type { ImportantDate, ImportantDateInput, Occasion } from '@/types'

const REMIND = [0, 1, 3, 7, 14, 30]
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTH_ABBR[Number(iso.slice(5, 7)) - 1]}`

function daysLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  if (days < 60) return `In ${Math.round(days / 7) === 1 ? '1 week' : `${Math.round(days / 7)} weeks`}`
  return `In ${Math.round(days / 30)} months`
}

export function DatesSection({ knownPeople }: { knownPeople: string[] }) {
  const { showToast } = useToast()
  const { dates, loading, error, refetch, createDate, creating, updateDate, updating, deleteDate, deleting } = useImportantDates()
  const today = todayIstDateKey()
  const [editor, setEditor] = useState<ImportantDate | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ImportantDate | null>(null)

  const upcoming = useMemo(
    () => dates.map((d) => ({ d, ...nextOccurrence(d, today) })).sort((a, b) => a.days - b.days),
    [dates, today],
  )
  const groups = [
    { title: 'Today', rows: upcoming.filter((u) => u.days === 0) },
    { title: 'This week', rows: upcoming.filter((u) => u.days > 0 && u.days <= 7) },
    { title: 'This month', rows: upcoming.filter((u) => u.days > 7 && u.days <= 31) },
    { title: 'Later', rows: upcoming.filter((u) => u.days > 31) },
  ]

  const save = async (input: ImportantDateInput) => {
    try {
      if (editor && editor !== 'new') {
        await updateDate(editor.id, input)
        showToast('Date updated')
      } else {
        await createDate(input)
        showToast(`Saved — Luma will remind you ${input.remindDaysBefore ? `${input.remindDaysBefore} day${input.remindDaysBefore > 1 ? 's' : ''} before` : 'on the day'}`)
      }
      setEditor(null)
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the date."), 'error')
    }
  }

  if (loading) return <ListSkeleton rows={4} />
  if (error && !dates.length) return <ErrorState title="Couldn't load your dates" description={error} onRetry={() => void refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-soft">Birthdays, anniversaries and remembrance days — reminded before they arrive, so a wish or gift is never late.</p>
        <Button size="sm" className="shrink-0 self-start sm:self-auto" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
          Add date
        </Button>
      </div>

      {dates.length === 0 ? (
        <EmptyState
          icon={<CalendarHeart size={20} />}
          title="No dates yet"
          description="Add family birthdays and anniversaries — Luma reminds you a week before and on the day."
          action={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setEditor('new')}>
              Add the first one
            </Button>
          }
        />
      ) : (
        groups.map(
          (group) =>
            group.rows.length > 0 && (
              <div key={group.title}>
                <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{group.title}</p>
                <div className={cn(group.title === 'Today' ? 'space-y-2' : 'divide-y divide-border-soft overflow-hidden rounded-card border border-border-soft bg-card')}>
                  {group.rows.map(({ d, date, days, count }) => {
                    const meta = OCCASIONS[d.occasion]
                    const Icon = meta.icon
                    const wish = meta.wish(d.person.split(/[ &]/)[0] || d.person, count)
                    const isToday = days === 0
                    return (
                      <div
                        key={d.id}
                        className={cn(
                          'group flex items-center gap-3 px-3.5 py-3',
                          isToday && 'rounded-card border border-rust/30 bg-rust/[0.06]',
                        )}
                      >
                        <span className="relative shrink-0">
                          <Avatar name={d.person} size={38} />
                          <span className={cn('absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card', isToday ? 'bg-rust text-paper' : 'bg-bg-soft text-ink-soft')}>
                            <Icon size={11} />
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{dateTitle(d)}</p>
                          <p className="truncate text-[11px] text-ink-muted">
                            {shortDate(date)}
                            {countLabel(d, count) && ` · ${countLabel(d, count)}`}
                            {d.notes && ` · ${d.notes}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-medium', isToday ? 'bg-rust text-paper' : days <= 7 ? 'bg-warning-soft text-ink' : 'bg-bg-soft text-ink-soft')}>
                            {daysLabel(days)}
                          </span>
                          {isToday && wish && (
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(wish)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-medium text-success hover:underline"
                            >
                              <MessageCircle size={12} /> Send wishes
                            </a>
                          )}
                        </div>
                        <RowActions
                          label={`Actions for ${dateTitle(d)}`}
                          actions={[
                            { label: 'Edit', icon: <Pencil size={13} />, onClick: () => setEditor(d) },
                            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setDeleteTarget(d), tone: 'danger' },
                          ]}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ),
        )
      )}

      <DateEditor
        open={editor !== null}
        value={editor === 'new' ? null : editor}
        knownPeople={knownPeople}
        saving={creating || updating}
        onClose={() => setEditor(null)}
        onSave={(input) => void save(input)}
      />
      <DeleteRecordDialog
        open={deleteTarget !== null}
        recordType="date"
        recordName={deleteTarget ? dateTitle(deleteTarget) : undefined}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteDate(deleteTarget.id)
            showToast('Date removed')
            setDeleteTarget(null)
          } catch (err) {
            showToast(getErrorMessage(err, "Couldn't delete the date."), 'error')
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function DateEditor({
  open,
  value,
  knownPeople,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  value: ImportantDate | null
  knownPeople: string[]
  saving: boolean
  onClose: () => void
  onSave: (input: ImportantDateInput) => void
}) {
  const listId = useId()
  const [person, setPerson] = useState('')
  const [occasion, setOccasion] = useState<Occasion>('Birthday')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [yearKnown, setYearKnown] = useState(true)
  const [remind, setRemind] = useState(7)
  const [notes, setNotes] = useState('')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    setPerson(value?.person ?? '')
    setOccasion(value?.occasion ?? 'Birthday')
    setTitle(value?.title ?? '')
    setDate(value ? (value.yearKnown ? value.date : `${new Date().getFullYear()}${value.date.slice(4)}`) : '')
    setYearKnown(value?.yearKnown ?? true)
    setRemind(value?.remindDaysBefore ?? 7)
    setNotes(value?.notes ?? '')
    setAttempted(false)
  }, [open, value])

  const errors = { person: person.trim() ? '' : 'Whose date is it?', date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : 'Pick the date.' }
  const submit = () => {
    setAttempted(true)
    if (errors.person || errors.date) return
    // Without a known year, the date is stored on a neutral year so no age is shown.
    const stored = yearKnown ? date : `1900${date.slice(4)}`
    onSave({ person: person.trim(), occasion, title: title.trim(), date: stored, yearKnown, remindDaysBefore: remind, notes: notes.trim() })
  }

  return (
    <Modal open={open} onClose={onClose} busy={saving} title={value ? 'Edit date' : 'Add an important date'} subtitle="Reminded on the bell and in your morning email">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Who</p>
            <Input list={listId} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Mom, Rahul, Nani…" autoFocus={!value} className={cn(attempted && errors.person && 'border-danger')} />
            <datalist id={listId}>
              {knownPeople.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            {attempted && errors.person && <p className="mt-1 text-[11px] text-danger">{errors.person}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Occasion</p>
            <ThemedSelect value={occasion} onChange={(v) => setOccasion(v as Occasion)} options={OCCASION_NAMES.map((o) => ({ value: o, label: OCCASIONS[o].label }))} aria-label="Occasion" />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Date</p>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(attempted && errors.date && 'border-danger')} />
          {attempted && errors.date && <p className="mt-1 text-[11px] text-danger">{errors.date}</p>}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={!yearKnown} onChange={(e) => setYearKnown(!e.target.checked)} className="h-4 w-4 accent-rust" />
            I don't know the year (only day and month)
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Remind me</p>
            <ThemedSelect
              value={String(remind)}
              onChange={(v) => setRemind(Number(v))}
              options={REMIND.map((r) => ({ value: String(r), label: r === 0 ? 'On the day' : `${r} day${r > 1 ? 's' : ''} before` }))}
              aria-label="Remind me"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Name it (optional)</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={person ? `${person}'s ${OCCASIONS[occasion].label.toLowerCase()}` : 'Auto'} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Notes (optional)</p>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gift ideas, cake preference, call at 9 AM…" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={saving} loadingText="Saving…">
            {value ? 'Save changes' : 'Save date'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
