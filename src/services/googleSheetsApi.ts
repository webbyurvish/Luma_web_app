import type {
  CreateApiResponse,
  HealthCheckResponse,
  ListApiResponse,
  RawAccount,
  RawInvestment,
  RawLiability,
  RawNote,
  RawSip,
  RawTransaction,
  TransactionsApiResponse,
} from '@/types'

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

async function fetchList<T>(action: string, signal?: AbortSignal): Promise<T[]> {
  const payload = await fetchJson<ListApiResponse<T>>(action, signal)
  if (!payload.success) {
    throw new GoogleSheetsApiError(payload.error || `Google Sheets API reported a failure fetching ${action}.`)
  }
  if (!Array.isArray(payload.data)) {
    throw new GoogleSheetsApiError(`Google Sheets API response was missing the ${action} list.`)
  }
  return payload.data
}

/**
 * POSTs a new record. Apps Script Web App POST responses redirect through a chain that
 * browsers can't reliably follow back to parseable JSON, even though the write itself
 * lands in the sheet — confirmed by re-fetching after a POST whose response looked like
 * a failure. So a response here that isn't valid `{success:true}` JSON is NOT treated as
 * a definite failure; only an explicit `{success:false}` is. Everything else resolves and
 * the caller re-fetches the list afterward to get the real, persisted state.
 */
async function postEntity(action: string, payload: Record<string, unknown>): Promise<void> {
  let response: Response
  try {
    response = await fetch(buildEndpoint(action), {
      method: 'POST',
      // text/plain avoids a CORS preflight against Apps Script, which doesn't handle OPTIONS.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new GoogleSheetsApiError('Could not reach the Google Sheets API. Check your network connection and try again.')
  }

  try {
    const body = (await response.json()) as CreateApiResponse<unknown>
    if (body.success === false) {
      throw new GoogleSheetsApiError(body.error || 'Google Sheets API reported a failure saving this record.')
    }
  } catch (err) {
    if (err instanceof GoogleSheetsApiError) throw err
    // Response wasn't parseable JSON — expected for POST (see comment above). Not an error.
  }
}

export async function getAccounts(signal?: AbortSignal): Promise<RawAccount[]> {
  return fetchList<RawAccount>('accounts', signal)
}

export async function getInvestments(signal?: AbortSignal): Promise<RawInvestment[]> {
  return fetchList<RawInvestment>('investments', signal)
}

export async function getSips(signal?: AbortSignal): Promise<RawSip[]> {
  return fetchList<RawSip>('sips', signal)
}

export async function getLiabilities(signal?: AbortSignal): Promise<RawLiability[]> {
  return fetchList<RawLiability>('liabilities', signal)
}

export async function getNotes(signal?: AbortSignal): Promise<RawNote[]> {
  return fetchList<RawNote>('notes', signal)
}

export function createAccount(payload: Record<string, unknown>): Promise<void> {
  return postEntity('account', payload)
}

export function createInvestment(payload: Record<string, unknown>): Promise<void> {
  return postEntity('investment', payload)
}

export function createSip(payload: Record<string, unknown>): Promise<void> {
  return postEntity('sip', payload)
}

export function createLiability(payload: Record<string, unknown>): Promise<void> {
  return postEntity('liability', payload)
}

export function createNote(payload: Record<string, unknown>): Promise<void> {
  return postEntity('note', payload)
}

/**
 * Update and archive/deactivate/close/void calls all share the same `postEntity`
 * re-fetch-to-confirm behavior as create — see the comment on postEntity above.
 * `operation` + `id` travel inside the JSON body; `action` (the query param) stays
 * the entity's singular name, exactly as create already uses it.
 */
export function updateAccount(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('account', { operation: 'update', id, ...payload })
}

export function archiveAccount(id: string): Promise<void> {
  return postEntity('account', { operation: 'archive', id })
}

export function updateInvestment(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('investment', { operation: 'update', id, ...payload })
}

export function archiveInvestment(id: string): Promise<void> {
  return postEntity('investment', { operation: 'archive', id })
}

export function updateSip(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('sip', { operation: 'update', id, ...payload })
}

export function deactivateSip(id: string): Promise<void> {
  return postEntity('sip', { operation: 'deactivate', id })
}

export function updateLiability(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('liability', { operation: 'update', id, ...payload })
}

export function closeLiability(id: string): Promise<void> {
  return postEntity('liability', { operation: 'close', id })
}

export function voidTransaction(id: string): Promise<void> {
  return postEntity('transaction', { operation: 'void', id })
}

export function updateNote(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('note', { operation: 'update', id, ...payload })
}

export function archiveNote(id: string): Promise<void> {
  return postEntity('note', { operation: 'archive', id })
}
