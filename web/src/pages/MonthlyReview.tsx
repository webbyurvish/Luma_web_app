import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Coins, FileUp, Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { useRouteIntent } from '@/hooks/useRouteIntent'
import { buildMonthReview, monthName, monthsWithData, shiftMonth, type PayeeLine } from '@/lib/monthReview'
import { formatCurrency } from '@/lib/formatCurrency'
import { formatDate, todayIstDateKey } from '@/lib/formatDate'
import { cn } from '@/lib/cn'

/** Early in a month, the useful review is the month that just ended. */
function defaultMonth(available: string[]): string {
  const today = todayIstDateKey()
  const current = today.slice(0, 7)
  const preferred = Number(today.slice(8, 10)) <= 7 ? shiftMonth(current, -1) : current
  return available.includes(preferred) ? preferred : available[0] ?? current
}

export function MonthlyReview() {
  const { transactions, loading, error, refetch } = useTransactions()
  const navigate = useNavigate()
  const available = useMemo(() => monthsWithData(transactions), [transactions])
  const [picked, setPicked] = useState<string | null>(null)
  useRouteIntent((intent) => {
    if (intent.tab && /^\d{4}-\d{2}$/.test(intent.tab)) setPicked(intent.tab)
  })
  const month = picked ?? defaultMonth(available)
  const review = useMemo(() => buildMonthReview(transactions, month), [transactions, month])
  const prevName = monthName(shiftMonth(month, -1), false)
  const idx = available.indexOf(month)
  const older = idx >= 0 ? available[idx + 1] : available.find((m) => m < month)
  const newer = idx > 0 ? available[idx - 1] : [...available].reverse().find((m) => m > month)
  const openPayee = (p: PayeeLine) => navigate('/transactions', { state: { search: p.name } })

  if (loading) return <ListSkeleton rows={6} />
  if (error && !transactions.length) return <ErrorState title="Couldn't load your transactions" description={error} onRetry={() => void refetch()} />

  const delta = review.previousSpent ? (review.spent - review.previousSpent) / review.previousSpent : null
  const maxDay = Math.max(1, ...review.daily)
  const maxCat = Math.max(1, ...review.categories.map((c) => c.amount))

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />} disabled={!older} onClick={() => older && setPicked(older)} aria-label="Previous month">
          <span className="hidden sm:inline">{older ? monthName(older, false) : ''}</span>
        </Button>
        <h2 className="font-display text-xl italic text-ink">{monthName(month)}</h2>
        <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />} iconPosition="right" disabled={!newer} onClick={() => newer && setPicked(newer)} aria-label="Next month">
          <span className="hidden sm:inline">{newer ? monthName(newer, false) : ''}</span>
        </Button>
      </div>

      {review.count === 0 ? (
        <EmptyState
          icon={<Coins size={20} />}
          title={`No spending recorded in ${monthName(month, false)}`}
          description="Import your Google Pay statement and Luma fills this in — where the money went, what changed and the small spends that add up."
          action={
            <Button size="sm" icon={<FileUp size={13} />} onClick={() => navigate('/transactions', { state: { tab: 'import-gpay' } })}>
              Import Google Pay statement
            </Button>
          }
        />
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Spent</p>
                <p className="font-mono-figure text-3xl font-semibold text-ink">{formatCurrency(review.spent)}</p>
                {delta !== null && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                    {delta >= 0 ? <ArrowUpRight size={13} className="text-danger" /> : <ArrowDownRight size={13} className="text-success" />}
                    {Math.abs(Math.round(delta * 100))}% {delta >= 0 ? 'more' : 'less'} than {prevName} ({formatCurrency(review.previousSpent)})
                  </p>
                )}
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-[11px] text-ink-muted">Received</p>
                  <p className="font-mono-figure text-sm font-semibold text-ink">{formatCurrency(review.received)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-ink-muted">Payments</p>
                  <p className="font-mono-figure text-sm font-semibold text-ink">{review.count}</p>
                </div>
              </div>
            </div>
            <DailyBars daily={review.daily} max={maxDay} month={month} />
          </Card>

          {review.smallFrequent.length > 0 && (
            <Card>
              <SectionTitle icon={<Coins size={14} />} title="Small spends that add up" hint="Paid often, a little at a time" />
              <ul className="divide-y divide-border-soft">
                {review.smallFrequent.slice(0, 6).map((p) => (
                  <li key={p.key}>
                    <button type="button" onClick={() => openPayee(p)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                        <p className="text-[11px] text-ink-muted">
                          {p.count} times · about {formatCurrency(p.average)} each · ≈ {formatCurrency(p.amount * 12)} a year at this pace
                        </p>
                      </div>
                      <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {review.changes.length > 0 && (
            <Card>
              <SectionTitle icon={<TrendingUp size={14} />} title={`What changed since ${prevName}`} />
              <ul className="divide-y divide-border-soft">
                {review.changes.map((c) => {
                  const up = c.ratio > 0
                  return (
                    <li key={c.label} className="flex items-center gap-3 py-2.5">
                      <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', up ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>
                        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {c.label} {up ? 'up' : 'down'} {Math.abs(Math.round(c.ratio * 100))}%
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {formatCurrency(c.previous)} → {formatCurrency(c.amount)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono-figure text-[12px] text-ink-soft">
                        {up ? '+' : '−'}
                        {formatCurrency(Math.abs(c.amount - c.previous))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <SectionTitle title="By category" hint={`vs ${prevName}`} />
              <ul className="space-y-3">
                {review.categories.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="truncate font-medium text-ink">{c.category}</span>
                      <span className="shrink-0 font-mono-figure text-ink">
                        {formatCurrency(c.amount)} <span className="text-[11px] text-ink-muted">· {Math.round(c.share * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-bg-soft" title={`${c.category}: ${formatCurrency(c.amount)} (${prevName}: ${formatCurrency(c.previous)})`}>
                      <div className="h-2 rounded-full bg-rust" style={{ width: `${Math.max(2, (c.amount / maxCat) * 100)}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-ink-muted">{c.previous ? `${prevName}: ${formatCurrency(c.previous)}` : `Nothing in ${prevName}`}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <SectionTitle title="Where you paid most" />
              <PayeeList list={review.payees.slice(0, 8)} onOpen={openPayee} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {review.newPayees.length > 0 && (
              <Card>
                <SectionTitle icon={<Sparkles size={14} />} title="New places this month" hint="Not paid in the 3 months before" />
                <PayeeList list={review.newPayees.slice(0, 8)} onOpen={openPayee} />
              </Card>
            )}
            <Card>
              <SectionTitle title="Biggest payments" />
              <ul className="divide-y divide-border-soft">
                {review.biggest.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{t.description}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {formatDate(t.date)} · {t.rawCategory}
                        {t.rawSubcategory ? ` · ${t.rawSubcategory}` : ''}
                        {t.note ? ` · ${t.note}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {icon && <span className="text-rust">{icon}</span>}
        {title}
      </p>
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </div>
  )
}

function PayeeList({ list, onOpen }: { list: PayeeLine[]; onOpen: (p: PayeeLine) => void }) {
  return (
    <ul className="divide-y divide-border-soft">
      {list.map((p) => (
        <li key={p.key}>
          <button type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-3 py-2.5 text-left">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
              <p className="text-[11px] text-ink-muted">
                {p.count} payment{p.count === 1 ? '' : 's'}
              </p>
            </div>
            <span className="shrink-0 font-mono-figure text-[13px] font-semibold text-ink">{formatCurrency(p.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Spend per day — one hue, hover/tap a day for its total. */
function DailyBars({ daily, max, month }: { daily: number[]; max: number; month: string }) {
  const [active, setActive] = useState<number | null>(null)
  const peak = daily.indexOf(Math.max(...daily))
  const shown = active ?? peak
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-ink-muted">
        <span>Spend per day</span>
        <span className="font-mono-figure text-ink-soft">
          {formatDate(`${month}-${String(shown + 1).padStart(2, '0')}`)} · {formatCurrency(daily[shown] ?? 0)}
          {active === null && daily[peak] > 0 ? ' (highest)' : ''}
        </span>
      </div>
      <div className="flex h-20 items-end gap-[2px]" onMouseLeave={() => setActive(null)} role="img" aria-label={`Daily spending in ${monthName(month)}`}>
        {daily.map((v, i) => (
          <button
            key={i}
            type="button"
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={`${i + 1}: ${formatCurrency(v)}`}
          >
            <span
              className={cn('w-full rounded-t-[3px] transition-colors', i === shown ? 'bg-rust' : 'bg-rust/35')}
              style={{ height: v > 0 ? `${Math.max(4, (v / max) * 100)}%` : '2px', opacity: v > 0 ? 1 : 0.4 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-muted">
        <span>1</span>
        <span>{Math.ceil(daily.length / 2)}</span>
        <span>{daily.length}</span>
      </div>
    </div>
  )
}
