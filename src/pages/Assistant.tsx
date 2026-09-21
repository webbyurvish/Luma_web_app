import { useState } from 'react'
import { CalendarClock, FileText, HandCoins, Wallet } from 'lucide-react'
import { ConversationList } from '@/components/assistant/ConversationList'
import { ChatWindow } from '@/components/assistant/ChatWindow'
import { ChatInput } from '@/components/assistant/ChatInput'
import { Card } from '@/components/ui/Card'
import { mockChatMessages, mockConversations } from '@/data/mockAssistant'
import { formatCurrency } from '@/lib/formatCurrency'
import { mockFinanceSummary } from '@/data/mockExpenses'
import { mockUdhaarSummary } from '@/data/mockUdhaar'
import type { ChatMessage } from '@/types'

const contextItems = [
  { icon: Wallet, label: 'Current balance', value: formatCurrency(mockFinanceSummary.currentBalance), color: 'text-gold-dark', bg: 'bg-warning-soft' },
  { icon: HandCoins, label: 'Udhaar to receive', value: formatCurrency(mockUdhaarSummary.toReceive), color: 'text-ai', bg: 'bg-ai-soft' },
  { icon: CalendarClock, label: 'Tasks due today', value: '3 tasks', color: 'text-info', bg: 'bg-info-soft' },
  { icon: FileText, label: 'Documents', value: '9 files', color: 'text-success', bg: 'bg-success-soft' },
]

export function Assistant() {
  const [activeId, setActiveId] = useState(mockConversations[0].id)
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages)

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
    <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_260px]">
      <Card className="hidden max-h-[calc(100vh-140px)] lg:flex lg:flex-col">
        <ConversationList
          conversations={mockConversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={() => setMessages([])}
        />
      </Card>

      <Card className="flex min-h-[calc(100vh-140px)] flex-col">
        <ChatWindow messages={messages} />
        <ChatInput onSend={handleSend} />
      </Card>

      <div className="hidden flex-col gap-4 xl:flex">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Quick context</h3>
          <ul className="space-y-3">
            {contextItems.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${item.bg} ${item.color}`}>
                  <item.icon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink-soft">{item.label}</p>
                  <p className="truncate text-sm font-semibold text-ink">{item.value}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
