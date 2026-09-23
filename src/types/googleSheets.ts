/** Raw transaction row exactly as the Google Apps Script Web App returns it. */
export interface RawTransaction {
  timestamp: string
  date: string
  amount: number
  type: string
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
  month: string
}

export interface TransactionsApiResponse {
  success: boolean
  count?: number
  transactions?: RawTransaction[]
  error?: string
}

export interface HealthCheckResponse {
  success: boolean
  error?: string
}
