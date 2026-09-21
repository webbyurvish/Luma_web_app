import type { ChatMessage, Conversation, SuggestedPrompt } from '@/types'

export const mockConversations: Conversation[] = [
  { id: 'cv-001', title: 'Monthly spending review', preview: 'You spent 8% less than August...', updatedAt: '2026-09-21', active: true },
  { id: 'cv-002', title: 'Udhaar follow-ups', preview: 'Rahul and Jay have pending dues...', updatedAt: '2026-09-18' },
  { id: 'cv-003', title: 'Insurance renewal reminder', preview: 'Car insurance renews on Sep 18...', updatedAt: '2026-09-12' },
  { id: 'cv-004', title: 'Festival budget planning', preview: 'Suggested a ₹15,000 shopping cap...', updatedAt: '2026-09-04' },
]

export const mockChatMessages: ChatMessage[] = [
  { id: 'msg-001', role: 'assistant', content: "Good evening! I'm your personal assistant — I can help with your finances, documents, and tasks. What would you like to know?", timestamp: '2026-09-21T18:02:00' },
  { id: 'msg-002', role: 'user', content: 'How much did I spend this month?', timestamp: '2026-09-21T18:02:40' },
  { id: 'msg-003', role: 'assistant', content: "You've spent ₹60,440 so far this September — about 8% less than August. Food and shopping are your top categories.", timestamp: '2026-09-21T18:02:55' },
]

export const mockSuggestedPrompts: SuggestedPrompt[] = [
  { id: 'sp-001', label: 'How much did I spend this month?' },
  { id: 'sp-002', label: 'Who owes me money?' },
  { id: 'sp-003', label: 'What bills are due?' },
  { id: 'sp-004', label: 'Find a document' },
  { id: 'sp-005', label: 'Show my tasks' },
]
