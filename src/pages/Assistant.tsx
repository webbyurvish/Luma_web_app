import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarClock, HandCoins, ListChecks, Lock, RotateCcw, Wallet } from 'lucide-react'
import { ChatWindow } from '@/components/assistant/ChatWindow'
import { ChatComposer } from '@/components/assistant/ChatComposer'
import { AssistantEmptyState } from '@/components/assistant/AssistantEmptyState'
import { LumaSpark } from '@/components/assistant/LumaSpark'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { InlineValueSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/formatCurrency'
import { getNetWorth } from '@/lib/financeCalculations'
import { SUGGESTED_PROMPTS } from '@/lib/assistantPrompts'
import { useFinanceSnapshot } from '@/hooks/useFinanceSnapshot'
import { useTasks, useUdhaar } from '@/hooks/useLifeCollections'
import { useAccounts, useInvestments, useLiabilities } from '@/hooks/useFinanceCollections'
import { useTransactions } from '@/hooks/useTransactions'
import { askAssistant, getAiStatus } from '@/services/googleSheetsApi'
import { calculateTodayExpense } from '@/lib/transactionCalculations'
import { cn } from '@/lib/cn'
import type { ChatMessage } from '@/types'

const STORAGE_KEY = 'luma:assistant:v1'
const MAX_STORED = 40

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)))
  } catch {
    // Storage blocked or full — the chat still works, it just won't survive a reload.
  }
}

const makeMessage = (role: ChatMessage['role'], content: string, error = false): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date().toISOString(),
  ...(error ? { error: true } : {}),
})

export function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [thinking, setThinking] = useState(false)
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())
  const { snapshot, loading: snapshotLoading } = useFinanceSnapshot()

  const { transactions, loading: txLoading } = useTransactions()
  const { summary: udhaar, loading: udhaarLoading } = useUdhaar()
  const { tasks, loading: tasksLoading } = useTasks()
  const { accounts } = useAccounts()
  const { investments } = useInvestments()
  const { liabilities } = useLiabilities()

  useEffect(() => saveMessages(messages), [messages])
  // Confirm AI is available in the background, so the first question skips that round trip.
  useEffect(() => {
    void getAiStatus().catch(() => {})
  }, [])

  // Latest snapshot/messages without re-creating `ask` on every data refresh.
  const snapshotRef = useRef(snapshot)
  const messagesRef = useRef(messages)
  useEffect(() => {
    snapshotRef.current = snapshot
    messagesRef.current = messages
  })

  /** Sends `question` with the conversation so far (`history`, ending before the question). */
  const ask = useCallback(async (question: ChatMessage, history: ChatMessage[]) => {
    setThinking(true)
    try {
      const reply = await askAssistant(
        [...history.filter((m) => !m.error), question].map((m) => ({ role: m.role, content: m.content })),
        snapshotRef.current,
      )
      const answer = makeMessage('assistant', reply)
      setFreshIds((prev) => new Set(prev).add(answer.id))
      setMessages((prev) => [...prev, answer])
    } catch (err) {
      setMessages((prev) => [...prev, makeMessage('assistant', err instanceof Error ? err.message : "Sorry, I couldn't answer that. Please try again.", true)])
    } finally {
      setThinking(false)
    }
  }, [])

  const send = useCallback(
    (content: string) => {
      const question = makeMessage('user', content)
      const history = messagesRef.current
      setMessages((prev) => [...prev, question])
      void ask(question, history)
    },
    [ask],
  )

  /** Re-asks the question behind an answer (or a failed attempt), replacing that answer. */
  const retry = useCallback(
    (assistantId: string) => {
      const all = messagesRef.current
      const index = all.findIndex((m) => m.id === assistantId)
      const question = all.slice(0, index).reverse().find((m) => m.role === 'user')
      if (!question || thinking) return
      const kept = all.slice(0, index)
      setMessages(kept)
      void ask(question, kept.slice(0, kept.lastIndexOf(question)))
    },
    [ask, thinking],
  )

  // A question handed over from the Dashboard's "Ask Luma" card — sent once the data is ready.
  const location = useLocation()
  const navigate = useNavigate()
  const pendingAsk = (location.state as { ask?: string } | null)?.ask
  // Effects can run twice (StrictMode, or before the state clear lands) — send each handover once.
  const handledKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingAsk || snapshotLoading || handledKeyRef.current === location.key) return
    handledKeyRef.current = location.key
    navigate('.', { replace: true, state: null })
    send(pendingAsk)
  }, [pendingAsk, snapshotLoading, navigate, send, location.key])

  const handleSend = (content: string) => {
    if (thinking || snapshotLoading) return
    send(content)
  }

  const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content))
  const followUps = SUGGESTED_PROMPTS.filter((p) => !asked.has(p)).slice(0, 3)

  const spentToday = useMemo(() => calculateTodayExpense(transactions), [transactions])
  const openTasks = tasks.filter((t) => !t.completed && t.status !== 'Cancelled').length
  const netWorth = getNetWorth({ accounts, investments, liabilities, udhaarReceivable: udhaar.toReceive }).netWorth

  const dayTiles: { label: string; icon: typeof Wallet; value: ReactNode; tone: string }[] = [
    { label: 'Spent today', icon: Wallet, value: txLoading ? <InlineValueSkeleton /> : formatCurrency(spentToday, { compact: true }), tone: 'text-rust bg-rust-soft/70' },
    { label: 'Udhaar to receive', icon: HandCoins, value: udhaarLoading ? <InlineValueSkeleton /> : formatCurrency(udhaar.toReceive, { compact: true }), tone: 'text-ai bg-ai-soft' },
    { label: 'Open tasks', icon: ListChecks, value: tasksLoading ? <InlineValueSkeleton /> : String(openTasks), tone: 'text-warning bg-warning-soft' },
    { label: 'Net worth', icon: CalendarClock, value: snapshotLoading ? <InlineValueSkeleton /> : formatCurrency(netWorth, { compact: true }), tone: 'text-success bg-success-soft' },
  ]

  const empty = messages.length === 0 && !thinking

  return (
    <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-[1fr_232px]">
      <Card variant="panel" className="flex h-[calc(100vh-130px)] min-h-[520px] flex-col p-0">
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3">
          <div className="flex items-center gap-2.5">
            <LumaSpark size={24} />
            <div>
              <p className="font-display text-base italic leading-tight text-ink">Ask Luma</p>
              <p className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                <span className={cn('h-1.5 w-1.5 rounded-full', snapshotLoading ? 'animate-pulse bg-warning' : 'bg-success')} />
                {snapshotLoading ? 'Loading your data…' : 'Connected to your ledger'}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={12} />}
              onClick={() => {
                setMessages([])
                setFreshIds(new Set())
              }}
              disabled={thinking}
            >
              New chat
            </Button>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
          {empty ? (
            <AssistantEmptyState onPrompt={handleSend} disabled={snapshotLoading} />
          ) : (
            <ChatWindow messages={messages} thinking={thinking} freshIds={freshIds} followUps={followUps} onRetry={retry} onFollowUp={handleSend} />
          )}
        </div>

        <div className="border-t border-border-soft bg-surface/60 px-4 pb-3 pt-3">
          <ChatComposer onSend={handleSend} busy={thinking} preparing={snapshotLoading} />
        </div>
      </Card>

      <aside className="hidden flex-col gap-4 lg:flex">
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Your day</p>
          <ul className="space-y-2">
            {dayTiles.map((tile) => {
              const Icon = tile.icon
              return (
                <li key={tile.label} className="flex items-center gap-3 rounded-card border border-border-soft bg-card px-3 py-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tile.tone}`}>
                    <Icon size={13} />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] text-ink-soft">{tile.label}</span>
                  <span className="font-mono-figure text-xs font-bold text-ink">{tile.value}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="rounded-card border border-dashed border-border px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            <Lock size={10} /> What Luma sees
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            A summary of your transactions, accounts, investments, SIPs, liabilities, udhaar and open tasks goes to your own Azure OpenAI
            resource with each question. Notes and documents are never sent.
          </p>
        </div>
      </aside>
    </div>
  )
}
