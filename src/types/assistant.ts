export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  preview: string
  updatedAt: string
  active?: boolean
}

export interface SuggestedPrompt {
  id: string
  label: string
}
