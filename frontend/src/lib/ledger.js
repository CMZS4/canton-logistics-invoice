// ═══════════════════════════════════════════════════════════
// CANTON LEDGER API CLIENT
// ═══════════════════════════════════════════════════════════
//
// All commands sent through submitCommand are authorized
// by the ledger itself, not by this client. Daml signatory
// and controller rules reject any unauthorized exercise —
// the role-aware UI is a UX layer, not a security layer.
// See "Architecture & Design Decisions" in the README.
//
// In MOCK MODE (VITE_MOCK_MODE=true), all calls are routed
// to mockLedger.js — an in-memory simulation used for static
// deploys (e.g. Vercel) where the Canton sandbox isn't
// reachable. The real ledger.js path is unchanged for local
// development.
// ═══════════════════════════════════════════════════════════

import {
  isMockMode,
  getMockParties,
  getMockActiveContracts,
  submitMockCommand,
  MOCK_PARTIES,
} from './mockLedger'

const API_BASE = import.meta.env.VITE_LEDGER_BASE_URL || ''

const cmdId = () =>
  `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ─── HTTP helper ───────────────────────────────────────────
// Wraps fetch with proper error handling for the real Canton
// path. Without this, a 4xx/5xx response would throw a cryptic
// "Cannot read property X of undefined" because we'd try to
// parse error responses as if they were successful JSON.
// Mock mode bypasses this entirely — see isMockMode() branches.
const FETCH_TIMEOUT_MS = 5000

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)')
      throw new Error(`Ledger ${res.status}: ${body}`)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Ledger request timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Public API ────────────────────────────────────────────

export async function fetchParties() {
  if (isMockMode()) {
    return await getMockParties()
  }
  // Devnet: parties are hardcoded — /v2/parties requires admin rights
  return [
    {
      party: 'ChainFreightShipper::1220195a56748e538153ecc527422256c235ff27b367483b04e161d3bbc62b1ebf32',
      displayName: 'ChainFreightShipper',
    },
    {
      party: 'ChainFreightCarrier::1220195a56748e538153ecc527422256c235ff27b367483b04e161d3bbc62b1ebf32',
      displayName: 'ChainFreightCarrier',
    },
  ]
}

export async function getLedgerEnd() {
  if (isMockMode()) {
    return 'mock-offset'
  }
  const data = await fetchJson(`${API_BASE}/v2/state/ledger-end`)
  return data.offset
}

export async function queryContracts(asParty) {
  if (isMockMode()) {
    const contracts = await getMockActiveContracts(asParty)
    // Wrap to match real API shape so parseContract can handle it
    return contracts.map((c) => ({
      contractEntry: {
        JsActiveContract: {
          createdEvent: {
            contractId: c.contractId,
            templateId: `mock:Logistics:${c.template}`,
            createArgument: c.payload,
          },
        },
      },
    }))
  }

  const offset = await getLedgerEnd()
  const data = await fetchJson(`${API_BASE}/v2/state/active-contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: {
        filtersByParty: {
          [asParty]: {
            cumulative: [
              {
                identifierFilter: {
                  WildcardFilter: { value: { includeCreatedEventBlob: false } },
                },
              },
            ],
          },
        },
      },
      verbose: true,
      activeAtOffset: offset.toString(),
    }),
  })
  return data || []
}

export async function submitCommand(asParty, commands) {
  if (isMockMode()) {
    // mockLedger expects a single command object, not an array of CreateCommand/ExerciseCommand wrappers
    const cmd = commands[0]
    let normalized
    if (cmd.CreateCommand) {
      normalized = {
        templateId: cmd.CreateCommand.templateId,
        argument: cmd.CreateCommand.createArguments,
      }
    } else if (cmd.ExerciseCommand) {
      normalized = {
        templateId: cmd.ExerciseCommand.templateId,
        contractId: cmd.ExerciseCommand.contractId,
        choice: cmd.ExerciseCommand.choice,
        argument: cmd.ExerciseCommand.choiceArgument,
      }
    } else {
      // Fallback: assume already-normalized shape
      normalized = cmd
    }
    try {
      const result = await submitMockCommand(asParty, normalized)
      return { updateId: `mock-update-${Date.now()}`, ...result }
    } catch (e) {
      throw new Error(e.message)
    }
  }

  const data = await fetchJson(`${API_BASE}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'chainfreight',
      commandId: cmdId(),
      actAs: [asParty],
      commands,
    }),
  })
  if (!data.updateId) {
    throw new Error(data.errors?.[0] || JSON.stringify(data))
  }
  return data
}

// Daml enum values come back as { tag: "Open", value: {} }
// — flatten them to a plain string for easier UI handling.
function unwrapEnum(value) {
  if (value && typeof value === 'object' && 'tag' in value) {
    return value.tag
  }
  return value
}

export function parseContract(entry) {
  const ev = entry.contractEntry?.JsActiveContract?.createdEvent
  if (!ev) return null
  const templateName = ev.templateId.split(':').pop()
  const fields = { ...ev.createArgument }
  // Normalize known enum fields
  if (fields.status) {
    fields.status = unwrapEnum(fields.status)
  }
  return {
    contractId: ev.contractId,
    template: templateName,
    fields,
  }
}
// Re-export for components that need to know which mode we're in
// (e.g. to show a "demo mode" banner in the UI).
export { isMockMode } from './mockLedger'
// ─── Currency helper ───────────────────────────────────────
// Maps currency codes to display symbols. Used by all panels
// to render amounts consistently. Defaults to $ if unknown.
export function currencySymbol(currency) {
  const symbols = { USD: '$', TRY: '₺', EUR: '€' }
  return symbols[currency] || '$'
}