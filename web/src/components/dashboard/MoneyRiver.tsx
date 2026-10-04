import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAccounts, useSips } from '@/hooks/useFinanceCollections'
import { useBills } from '@/hooks/usePlanning'
import { useImportantDates, useRecharges } from '@/hooks/useFamily'
import { useVehicles } from '@/hooks/useLife'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { buildRiver, riverDayLabel, type RiverEvent, type RiverTone } from '@/lib/moneyRiver'
import { formatCurrency } from '@/lib/formatCurrency'
import { todayIstDateKey } from '@/lib/formatDate'
import { cn } from '@/lib/cn'
import type { Transaction } from '@/types'

const DOT: Record<RiverTone, string> = {
  out: 'bg-rust',
  in: 'bg-success',
  remind: 'bg-amber',
  late: 'bg-danger',
}

const SHOW = 7

export function MoneyRiver({ transactions, loading }: { transactions: Transaction[]; loading: boolean }) {
  const navigate = useNavigate()
  const today = todayIstDateKey()
  const { accounts } = useAccounts()
  const { bills } = useBills()
  const { sips } = useSips()
  const { recharges } = useRecharges()
  const { dates } = useImportantDates()
  const { vehicles } = useVehicles()
  const { people } = useUdhaar()
  const [all, setAll] = useState(false)

  const river = useMemo(
    () => buildRiver({ today, transactions, accounts, bills, sips, recharges, dates, vehicles, receivables: people.map((p) => ({ name: p.name, outstanding: p.outstanding, dueDate: p.dueDate })) }),
    [today, transactions, accounts, bills, sips, recharges, dates, vehicles, people],
  )
  const open = (e: RiverEvent) => navigate(e.to, e.state ? { state: e.state } : undefined)
  const coming = all ? river.upcoming : river.upcoming.slice(0, SHOW)

  // Day headers only where the day changes, so the eye can run down the dates.
  let lastDay = ''
  const dayHeader = (date: string, first: boolean) => {
    if (date === lastDay) return null
    lastDay = date
    return <p className={cn('mb-0.5 pl-7 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted', first ? 'mt-0' : 'mt-3')}>{riverDayLabel(date, today)}</p>
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 font-display text-lg italic text-ink">
          <Waves size={17} className="text-rust" /> Money river
        </p>
        {river.outThisWeek > 0 && (
          <p className="text-[11.5px] text-ink-soft">
            <span className="font-mono-figure font-semibold text-ink">{formatCurrency(river.outThisWeek)}</span> going out this week
          </p>
        )}
      </div>

      <div className="relative">
        {/* the river itself */}
        <span className="absolute bottom-2 left-[9px] top-2 w-[2px] rounded-full bg-gradient-to-b from-border-soft via-border to-border-soft" aria-hidden="true" />

        {river.past.length > 0 && (
          <div>
            {[...river.past].reverse().map((e) => (
              <Row key={e.id} event={e} label={riverDayLabel(e.date, today)} onOpen={open} faded />
            ))}
          </div>
        )}

        <div className="relative my-3 flex items-center gap-3">
          <span className="relative z-10 grid size-5 shrink-0 place-items-center rounded-full bg-hero ring-4 ring-card">
            <span className="size-2 rounded-full bg-amber" />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 rounded-md bg-hero px-3 py-2 text-hero-ink shadow-hero">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-hero-muted">Now</span>
            <span className="min-w-0 truncate text-[12px] text-hero-muted">
              <span className="font-mono-figure text-[15px] font-semibold text-hero-ink">{loading && !river.accountCount ? '…' : formatCurrency(river.balance)}</span>
              {river.accountCount > 0 && ` in ${river.accountCount} account${river.accountCount === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {river.late.length > 0 && (
          <div className="mb-2">
            <p className="mb-0.5 pl-7 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-danger">Needs you</p>
            {river.late.map((e) => (
              <Row key={e.id} event={e} label={riverDayLabel(e.date, today)} onOpen={open} />
            ))}
          </div>
        )}

        {coming.length === 0 ? (
          <p className="py-3 pl-7 text-xs text-ink-muted">Nothing due in the next 30 days. Add bills, SIPs or recharges and they'll flow in here.</p>
        ) : (
          coming.map((e, i) => (
            <div key={e.id}>
              {dayHeader(e.date, i === 0)}
              <Row event={e} onOpen={open} />
            </div>
          ))
        )}

        {river.upcoming.length > SHOW && (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 pl-7 text-[11.5px] font-medium text-rust hover:underline">
            {all ? 'Show less' : `Show all ${river.upcoming.length} coming up`}
          </button>
        )}
      </div>
    </Card>
  )
}

function Row({ event: e, label, onOpen, faded }: { event: RiverEvent; label?: string; onOpen: (e: RiverEvent) => void; faded?: boolean }) {
  const amount = e.amount
  return (
    <button type="button" onClick={() => onOpen(e)} className="group relative flex w-full items-center gap-3 rounded-md py-1.5 text-left transition-colors hover:bg-bg-soft/60">
      <span className="relative z-10 grid size-5 shrink-0 place-items-center">
        <span className={cn('size-2.5 rounded-full ring-[3px] ring-card', DOT[e.tone], faded && 'size-2')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px]', faded ? 'text-ink-soft' : 'font-medium text-ink')}>{e.title}</span>
        <span className="block truncate text-[11px] text-ink-muted">{[label, e.detail].filter(Boolean).join(' · ')}</span>
      </span>
      {amount !== undefined && (
        <span className={cn('shrink-0 pr-1 font-mono-figure text-[12.5px]', amount > 0 ? 'text-success' : 'text-ink', !faded && 'font-semibold')}>
          {amount > 0 ? '+' : '−'}
          {formatCurrency(Math.abs(amount))}
        </span>
      )}
    </button>
  )
}
