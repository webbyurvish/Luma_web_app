import type {
  BootstrapApiResponse,
  DriveFile,
  DriveFileDetails,
  DriveFolder,
  DriveTree,
  RawTask,
  RawUdhaar,
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

/** Apps Script intermittently answers a healthy read with 404/429/5xx under load; those are worth retrying. */
const TRANSIENT_STATUS = new Set([404, 408, 429, 500, 502, 503, 504])
const READ_RETRY_DELAYS_MS = [700, 1800]

/**
 * Apps Script answers in two hops (302 → googleusercontent "echo"). Under parallel load Google
 * sometimes leaves the second hop hanging ~30s and then 404s, although the script already
 * finished. A healthy read lands in 2–6s, so an attempt that runs past its budget is abandoned
 * and retried instead of waited out.
 */
const READ_TIMEOUT_MS = 20_000
const SLOW_READ_TIMEOUT_MS: Record<string, number> = { bootstrap: 45_000, transactions: 35_000, drivetree: 45_000 }

class AttemptTimeout extends Error {}

/*
 * Google's second hop jams when several requests from one page are in flight at once, while
 * one or two at a time come back in seconds. So background re-syncs share 2 slots (counting
 * urgent work in flight too) and queue beyond that, while what the user is waiting on — saves,
 * AI answers — has its own lanes and never queues behind a hung background read.
 */
const MAX_BACKGROUND = 2
const MAX_URGENT = 3
let urgentInFlight = 0
let backgroundInFlight = 0
const urgentQueue: (() => void)[] = []
const backgroundQueue: (() => void)[] = []

function pump() {
  while (urgentQueue.length && urgentInFlight < MAX_URGENT) {
    urgentInFlight++
    urgentQueue.shift()!()
  }
  while (backgroundQueue.length && backgroundInFlight + urgentInFlight < MAX_BACKGROUND) {
    backgroundInFlight++
    backgroundQueue.shift()!()
  }
}

async function withSlot<T>(urgent: boolean, task: () => Promise<T>): Promise<T> {
  await new Promise<void>((run) => {
    ;(urgent ? urgentQueue : backgroundQueue).push(run)
    pump()
  })
  try {
    return await task()
  } finally {
    if (urgent) urgentInFlight--
    else backgroundInFlight--
    pump()
  }
}

/** fetch + full body read under one time budget; the caller's own abort still wins. */
function fetchTextWithin(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer?: AbortSignal,
  urgent = false,
): Promise<{ status: number; ok: boolean; text: string }> {
  // The time budget starts once a slot is free, not while queued.
  return withSlot(urgent, () => fetchTextNow(url, init, timeoutMs, outer))
}

async function fetchTextNow(url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal): Promise<{ status: number; ok: boolean; text: string }> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  outer?.addEventListener('abort', forwardAbort)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
  } catch (cause) {
    if (timedOut) throw new AttemptTimeout()
    throw cause
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', forwardAbort)
  }
}

// Reads only — writes (postEntity) are never retried, so nothing can be saved twice.
async function fetchJson<T>(action: string, signal?: AbortSignal): Promise<T> {
  const timeoutMs = SLOW_READ_TIMEOUT_MS[action] ?? READ_TIMEOUT_MS
  let result: { status: number; ok: boolean; text: string } | null = null
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < READ_RETRY_DELAYS_MS.length
    try {
      result = await fetchTextWithin(buildEndpoint(action), { method: 'GET' }, timeoutMs, signal)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError' && signal?.aborted) throw cause
      if (canRetry) {
        await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw new GoogleSheetsApiError(
        cause instanceof AttemptTimeout
          ? 'Google Sheets is taking too long to respond. Please try again in a moment.'
          : 'Could not reach the Google Sheets API. Check your network connection and try again.',
      )
    }
    if (result.ok || !TRANSIENT_STATUS.has(result.status) || !canRetry) break
    await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]))
  }

  if (!result.ok) {
    throw new GoogleSheetsApiError(`Google Sheets API returned an unexpected status (${result.status}). Please try again in a moment.`)
  }

  try {
    return JSON.parse(result.text) as T
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
function postEntity(action: string, payload: Record<string, unknown>): Promise<void> {
  // Saves the user is waiting on jump ahead of background reads. Never retried, never timed out.
  return withSlot(true, () => postEntityNow(action, payload))
}

async function postEntityNow(action: string, payload: Record<string, unknown>): Promise<void> {
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

/**
 * One request for accounts/investments/SIPs/liabilities/transactions. Throws on a deployment
 * that predates the route (it answers `Unknown action: bootstrap`), so callers can fall back
 * to the per-collection routes.
 */
export async function getBootstrap(signal?: AbortSignal): Promise<NonNullable<BootstrapApiResponse['data']>> {
  const payload = await fetchJson<BootstrapApiResponse>('bootstrap', signal)
  if (!payload.success || !payload.data) {
    throw new GoogleSheetsApiError(payload.error || 'Google Sheets API reported a failure fetching the bootstrap bundle.')
  }
  if (import.meta.env.DEV && payload.errors && Object.keys(payload.errors).length > 0) {
    console.warn('[getBootstrap] Some collections failed server-side:', payload.errors)
  }
  return payload.data
}

/* Permanent delete — removes the sheet row. The backend first copies it to its
 * "Deleted Records" sheet, and refuses to delete an account other records still use. */

export function deleteAccount(id: string): Promise<void> {
  return postEntity('account', { operation: 'delete', id })
}

export function deleteInvestment(id: string): Promise<void> {
  return postEntity('investment', { operation: 'delete', id })
}

export function deleteSip(id: string): Promise<void> {
  return postEntity('sip', { operation: 'delete', id })
}

export function deleteLiability(id: string): Promise<void> {
  return postEntity('liability', { operation: 'delete', id })
}

export function deleteNote(id: string): Promise<void> {
  return postEntity('note', { operation: 'delete', id })
}

export function deleteTransaction(id: string): Promise<void> {
  return postEntity('transaction', { operation: 'delete', id })
}

/** Partial update of a transaction's editable fields (date, amount, type, category, subcategory, paymentMethod, merchant, note). */
export function updateTransaction(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('transaction', { operation: 'update', id, ...payload })
}

/* Udhaar — a ledger: each row is one "Given" or "Repayment". Creates go through Udhaar.gs
 * (routed by `recordType`), edits/deletes through the lifecycle router like everything else. */

export async function getUdhaar(signal?: AbortSignal): Promise<RawUdhaar[]> {
  return fetchList<RawUdhaar>('udhaar', signal)
}

export function createUdhaarEntry(payload: Record<string, unknown>): Promise<void> {
  return postEntity('udhaar', payload)
}

export function updateUdhaarEntry(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('udhaar', { operation: 'update', id, ...payload })
}

export function deleteUdhaarEntry(id: string): Promise<void> {
  return postEntity('udhaar', { operation: 'delete', id })
}

/* Tasks */

export async function getTasks(signal?: AbortSignal): Promise<RawTask[]> {
  return fetchList<RawTask>('tasks', signal)
}

export function createTask(payload: Record<string, unknown>): Promise<void> {
  return postEntity('task', payload)
}

export function updateTask(id: string, payload: Record<string, unknown>): Promise<void> {
  return postEntity('task', { operation: 'update', id, ...payload })
}

export function archiveTask(id: string): Promise<void> {
  return postEntity('task', { operation: 'archive', id })
}

export function deleteTask(id: string): Promise<void> {
  return postEntity('task', { operation: 'delete', id })
}

/**
 * New transaction. Deliberately sent with no action/operation in the body so it takes the
 * exact same path as the iPhone Shortcut (which also assigns the new Transaction ID).
 */
export function createTransaction(payload: Record<string, unknown>): Promise<void> {
  return postEntity('transaction', payload)
}

/**
 * POST whose response body IS the result (AI answers), unlike postEntity's fire-and-refetch
 * writes. Verified in the browser: Apps Script's redirect is followed and the JSON is readable.
 */
async function postForResult<T extends { success: boolean; error?: string }>(action: string, payload: Record<string, unknown>): Promise<T> {
  // Only used for AI requests, which read data and never write — so, unlike postEntity, it's
  // safe to send the same request twice. A healthy answer takes 3–5s, but Google's second hop
  // randomly hangs for 20–30s. So if the first attempt is still out after HEDGE_AFTER_MS, a
  // second identical request goes out in parallel and whichever answers first wins.
  const HEDGE_AFTER_MS = 9_000
  const ATTEMPT_TIMEOUT_MS = 40_000
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }

  const attempt = async (): Promise<T> => {
    const result = await fetchTextWithin(buildEndpoint(action), init, ATTEMPT_TIMEOUT_MS, undefined, true)
    // When the hop jams, Google can fall back to re-running the URL as a GET, which answers
    // "Unknown action" — proof this attempt was never processed.
    if (/Unknown action/.test(result.text)) throw new GoogleSheetsApiError("Google didn't pass the question through. Please try again.")
    if (!result.ok) throw new GoogleSheetsApiError(`The assistant didn't return a readable answer (${result.status}). Please try again.`)
    let body: T
    try {
      body = JSON.parse(result.text) as T
    } catch {
      throw new GoogleSheetsApiError(`The assistant didn't return a readable answer (${result.status}). Please try again.`)
    }
    // An error the script itself reports (not configured, rate limit…) is final, not retryable.
    if (!body.success) throw Object.assign(new GoogleSheetsApiError(body.error || 'The assistant reported an error.'), { final: true })
    return body
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let failures = 0
    let started = 0

    const launch = () => {
      started++
      attempt().then(
        (body) => {
          if (settled) return
          settled = true
          clearTimeout(hedgeTimer)
          resolve(body)
        },
        (err: unknown) => {
          if (settled) return
          failures++
          const final = typeof err === 'object' && err !== null && 'final' in err
          if (final || failures >= 2) {
            settled = true
            clearTimeout(hedgeTimer)
            reject(err instanceof GoogleSheetsApiError ? err : new GoogleSheetsApiError('Could not reach the assistant. Please try again.'))
            return
          }
          // First attempt failed outright: send the backup now instead of waiting for the hedge.
          if (started < 2) {
            clearTimeout(hedgeTimer)
            launch()
          }
        },
      )
    }

    const hedgeTimer = setTimeout(() => {
      if (!settled && started < 2) launch()
    }, HEDGE_AFTER_MS)
    launch()
  })
}

/* AI (Azure OpenAI via Apps Script — the key never reaches the browser) */

export interface AiChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function askAssistant(messages: AiChatTurn[], context: string): Promise<string> {
  await requireAiChat()
  const body = await postForResult<{ success: boolean; error?: string; reply: string }>('ai', { aiTask: 'chat', messages, context })
  return body.reply
}

export interface QuickAddDraft {
  kind: 'expense' | 'income' | 'udhaar_given' | 'udhaar_repayment' | 'task' | 'unknown'
  amount: number | null
  date: string | null
  category: string | null
  subcategory: string | null
  merchant: string | null
  paymentMethod: string | null
  note: string | null
  person: string | null
  dueDate: string | null
  title: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  confidence: number
}

export async function parseQuickAdd(
  text: string,
  today: string,
  hints: { categories: string[]; paymentMethods: string[]; people: string[] },
): Promise<QuickAddDraft> {
  await requireAiChat()
  const body = await postForResult<{ success: boolean; error?: string; draft: QuickAddDraft }>('ai', { aiTask: 'parse', text, today, hints })
  return body.draft
}

/** Short-lived (10 min) Azure Speech token + region; the Speech key itself stays in Apps Script. */
export async function getSpeechToken(): Promise<{ token: string; region: string; expiresAt?: number }> {
  const status = await getAiStatus()
  if (!status.speech) throw new GoogleSheetsApiError("Azure Speech isn't set up yet. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Apps Script.")
  const body = await fetchJson<{ success: boolean; error?: string; token?: string; region?: string; expiresAt?: number }>('speechtoken')
  if (!body.success || !body.token || !body.region) throw new GoogleSheetsApiError(body.error || 'Voice input is not available right now.')
  return { token: body.token, region: body.region, expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : undefined }
}

/*
 * Safety gate: an older script deployment doesn't know aiTask and would treat an AI POST
 * as an iPhone-Shortcut transaction (appending a ₹0 row). So before the first AI POST we
 * ask, read-only, whether the deployed script supports AI at all — once per session.
 */
let aiStatusPromise: Promise<{ chat: boolean; speech: boolean }> | null = null

// A confirmed "available" is remembered for a while, so each chat doesn't pay for another
// round trip. Only a positive answer is cached; "not deployed"/"not configured" re-checks.
const AI_STATUS_KEY = 'luma:ai-status'
const AI_STATUS_TTL_MS = 6 * 60 * 60 * 1000

function readCachedAiStatus(): { chat: boolean; speech: boolean } | null {
  try {
    const cached = JSON.parse(localStorage.getItem(AI_STATUS_KEY) ?? 'null') as { at: number; chat: boolean; speech: boolean } | null
    return cached && cached.chat && Date.now() - cached.at < AI_STATUS_TTL_MS ? { chat: cached.chat, speech: cached.speech } : null
  } catch {
    return null
  }
}

export function getAiStatus(): Promise<{ chat: boolean; speech: boolean }> {
  const cached = readCachedAiStatus()
  if (cached) return Promise.resolve(cached)
  aiStatusPromise ??= fetchJson<{ success: boolean; error?: string; chat?: boolean; speech?: boolean }>('aistatus')
    .then((body) => {
      if (!body.success) throw new GoogleSheetsApiError('AI features need the latest Apps Script deployment. Deploy it, then reload.')
      const status = { chat: !!body.chat, speech: !!body.speech }
      if (status.chat) {
        try {
          localStorage.setItem(AI_STATUS_KEY, JSON.stringify({ at: Date.now(), ...status }))
        } catch {
          // Storage blocked — we'll simply check again next time.
        }
      }
      return status
    })
    .catch((err: unknown) => {
      aiStatusPromise = null // let a later attempt re-check (e.g. after deploying)
      throw err
    })
  return aiStatusPromise
}

async function requireAiChat() {
  const status = await getAiStatus()
  if (!status.chat) throw new GoogleSheetsApiError('Azure OpenAI isn\'t set up yet. Add the AZURE_OPENAI_* Script Properties in Apps Script.')
}

/* Luma Documents (Google Drive via Apps Script). Writes go through the same kind of gate as AI:
 * an older deployment would otherwise treat a driveOp POST as an iPhone-Shortcut transaction. */

let driveStatusPromise: Promise<void> | null = null

function requireDrive(): Promise<void> {
  driveStatusPromise ??= fetchJson<{ success: boolean; error?: string; drive?: boolean }>('drivestatus')
    .then((body) => {
      if (!body.success || !body.drive) throw new GoogleSheetsApiError('Documents need the latest Apps Script deployment. Deploy it, then reload.')
    })
    .catch((err: unknown) => {
      driveStatusPromise = null
      throw err
    })
  return driveStatusPromise
}

export async function getDriveTree(): Promise<DriveTree> {
  await requireDrive()
  const body = await fetchJson<{ success: boolean; error?: string } & Partial<DriveTree>>('drivetree')
  if (!body.success || !body.rootId) throw new GoogleSheetsApiError(body.error || "Couldn't load your documents.")
  return { rootId: body.rootId, rootUrl: body.rootUrl ?? '', folders: body.folders ?? [], files: body.files ?? [] }
}

/**
 * One document operation. Read back (the result matters) but never retried — a second upload
 * would create a duplicate file. Uploads get a longer budget since the bytes travel in the body.
 */
async function driveOp<T = Record<string, unknown>>(payload: Record<string, unknown>, timeoutMs = 60_000): Promise<T> {
  await requireDrive()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('drive'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) },
      timeoutMs,
      undefined,
      true,
    )
  } catch (cause) {
    throw new GoogleSheetsApiError(
      cause instanceof AttemptTimeout
        ? "Google is taking too long to confirm. Refresh in a moment to see whether it went through."
        : 'Could not reach Google. Check your connection and try again.',
    )
  }
  let body: { success?: boolean; error?: string } & T
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm the change. Refresh in a moment to see whether it went through.")
  }
  if (!body.success) throw new GoogleSheetsApiError(body.error || 'The change could not be saved.')
  return body
}

export const driveApi = {
  createFolder: (parentId: string, name: string) => driveOp<{ folder: DriveFolder }>({ driveOp: 'createFolder', parentId, name }),
  renameFolder: (folderId: string, name: string) => driveOp({ driveOp: 'renameFolder', folderId, name }),
  moveFolder: (folderId: string, targetId: string) => driveOp({ driveOp: 'moveFolder', folderId, targetId }),
  trashFolder: (folderId: string) => driveOp<{ trashedFiles: number }>({ driveOp: 'trashFolder', folderId }),
  upload: (folderId: string, file: { name: string; mimeType: string; dataBase64: string }, details?: Partial<DriveFileDetails>) =>
    driveOp<{ file: DriveFile }>({ driveOp: 'upload', folderId, ...file, ...details }, 120_000),
  updateFile: (fileId: string, details: Partial<DriveFileDetails>) => driveOp({ driveOp: 'updateFile', fileId, ...details }),
  moveFile: (fileId: string, folderId: string) => driveOp({ driveOp: 'moveFile', fileId, folderId }),
  trashFile: (fileId: string) => driveOp({ driveOp: 'trashFile', fileId }),
}
