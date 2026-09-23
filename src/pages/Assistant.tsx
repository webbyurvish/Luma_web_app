import { useMemo, useState } from 'react'
import { ConversationList } from '@/components/assistant/ConversationList'
import { ChatWindow } from '@/components/assistant/ChatWindow'
import { ChatInput } from '@/components/assistant/ChatInput'
import { AssistantEmptyState } from '@/components/assistant/AssistantEmptyState'
import { Card } from '@/components/ui/Card'
import { mockChatMessages, mockConversations } from '@/data/mockAssistant'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockUdhaarSummary } from '@/data/mockUdhaar'
import { useTransactions } from '@/hooks/useTransactions'
import { calculateBalance, calculateTodayExpense } from '@/lib/transactionCalculations'
import type { ChatMessage } from '@/types'

export function Assistant() {
  const [activeId, setActiveId] = useState(mockConversations[0].id)
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages)
  const { transactions, loading } = useTransactions()

  const spentToday = useMemo(() => calculateTodayExpense(transactions), [transactions])
  const balance = useMemo(() => calculateBalance(transactions), [transactions])

  const contextRows = [
    { label: 'Spent today', value: loading ? '—' : formatCurrency(spentToday, { compact: true }) },
    { label: 'Udhaar to receive', value: formatCurrency(mockUdhaarSummary.toReceive, { compact: true }) },
    { label: 'Tasks today', value: '3 open' },
    { label: 'Documents', value: '1 needs review' },
  ]

  const handleSend = (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "This is a UI preview — I'll be able to answer that once the AI assistant is connected in a future phase.",
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
  }

  return (
    <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-[190px_1fr] xl:grid-cols-[190px_1fr_220px]">
      <Card variant="flat" className="hidden max-h-[calc(100vh-130px)] border-r border-border-soft pr-4 lg:flex lg:flex-col">
        <ConversationList conversations={mockConversations} activeId={activeId} onSelect={setActiveId} onNew={() => setMessages([])} />
      </Card>

      <Card variant="panel" className="flex min-h-[calc(100vh-130px)] flex-col">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Ask Luma</p>
        {messages.length === 0 ? (
          <>
            <AssistantEmptyState onPrompt={handleSend} />
            <ChatInput onSend={handleSend} compact />
          </>
        ) : (
          <>
            <ChatWindow messages={messages} />
            <ChatInput onSend={handleSend} />
          </>
        )}
      </Card>

      <div className="hidden flex-col xl:flex">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Your day</p>
        <ul className="divide-y divide-border-soft border-t border-border-soft">
          {contextRows.map((row) => (
            <li key={row.label} className="flex items-baseline justify-between py-2.5">
              <span className="text-[11px] text-ink-soft">{row.label}</span>
              <span className="font-mono-figure text-xs font-bold text-ink">{row.value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border-soft pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ai">Insight</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            Dining spend is 14% higher than last month — mostly weekday lunches.
          </p>
        </div>
        <div className="mt-4 border-t border-border-soft pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Balance</p>
          <p className="mt-1.5 font-mono-figure text-sm font-bold text-ink">{loading ? '—' : formatCurrency(balance)}</p>
        </div>
      </div>
    </div>
  )
}
