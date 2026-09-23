import type { HealthCheckResponse, RawTransaction, TransactionsApiResponse } from '@/types'

export class GoogleSheetsApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleSheetsApiError'
  }
}

function getApiUrl(): string {
  const url = import.meta.env.VITE_GOOGLE_SHEETS_API_URL
  if (!url) {
    throw new GoogleSheetsApiError(
      'VITE_GOOGLE_SHEETS_API_URL is not configured. Add it to .env (see .env.example) with your Google Apps Script Web App URL.',
    )
  }
  return url
}

function buildEndpoint(action: string): string {
  const url = new URL(getApiUrl())
  url.searchParams.set('action', action)
  return url.toString()
}

async function fetchJson<T>(action: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(buildEndpoint(action), { method: 'GET', signal })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new GoogleSheetsApiError(`Could not reach the Google Sheets API. Check your network connection and try again.`)
  }

  if (!response.ok) {
    throw new GoogleSheetsApiError(`Google Sheets API returned an unexpected status (${response.status}).`)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new GoogleSheetsApiError('Google Sheets API returned a response that was not valid JSON.')
  }
}

/** Fetches every transaction row from the Apps Script Web App, normalized to a plain array. */
export async function getTransactions(signal?: AbortSignal): Promise<RawTransaction[]> {
  const payload = await fetchJson<TransactionsApiResponse>('transactions', signal)

  if (!payload.success) {
    throw new GoogleSheetsApiError(payload.error || 'Google Sheets API reported a failure fetching transactions.')
  }
  if (!Array.isArray(payload.transactions)) {
    throw new GoogleSheetsApiError('Google Sheets API response was missing the transactions list.')
  }
  return payload.transactions
}

/** Lightweight reachability check against ?action=health — not used for the main data flow. */
export async function healthCheck(signal?: AbortSignal): Promise<boolean> {
  const payload = await fetchJson<HealthCheckResponse>('health', signal)
  return payload.success === true
}
