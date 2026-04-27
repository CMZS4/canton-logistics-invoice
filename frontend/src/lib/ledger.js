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

const API_BASE = ''

const cmdId = () =>
  `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ─── Public API ────────────────────────────────────────────

export async function fetchParties() {
  if (isMockMode()) {
    return await getMockParties()
  }
  const res = await fetch(`${API_BASE}/v2/parties`)
  const data = await res.json()
  return data.partyDetails || []
}

export async function getLedgerEnd() {
  if (isMockMode()) {
    return 'mock-offset'
  }
  const res = await fetch(`${API_BASE}/v2/state/ledger-end`)
  const data = await res.json()
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
  const res = await fetch(`${API_BASE}/v2/state/active-contracts`, {
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
      activeAtOffset: offset,
    }),
  })
  const data = await res.json()
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

  const res = await fetch(`${API_BASE}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'chainfreight',
      commandId: cmdId(),
      actAs: [asParty],
      commands,
    }),
  })
  const data = await res.json()
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