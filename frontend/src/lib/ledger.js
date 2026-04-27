// ═══════════════════════════════════════════════════════════
// CANTON LEDGER API CLIENT
// ═══════════════════════════════════════════════════════════
//
// All commands sent through submitCommand are authorized
// by the ledger itself, not by this client. Daml signatory
// and controller rules reject any unauthorized exercise —
// the role-aware UI is a UX layer, not a security layer.
// See "Architecture & Design Decisions" in the README.
// ═══════════════════════════════════════════════════════════

const API_BASE = ''

const cmdId = () =>
  `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export async function fetchParties() {
  const res = await fetch(`${API_BASE}/v2/parties`)
  const data = await res.json()
  return data.partyDetails || []
}

export async function getLedgerEnd() {
  const res = await fetch(`${API_BASE}/v2/state/ledger-end`)
  const data = await res.json()
  return data.offset
}

export async function queryContracts(asParty) {
  const offset = await getLedgerEnd()
  const res = await fetch(`${API_BASE}/v2/state/active-contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter: {
        filtersByParty: {
          [asParty]: {
            cumulative: [{
              identifierFilter: {
                WildcardFilter: { value: { includeCreatedEventBlob: false } }
              }
            }]
          }
        }
      },
      verbose: true,
      activeAtOffset: offset
    })
  })
  const data = await res.json()
  return data || []
}

export async function submitCommand(asParty, commands) {
  const res = await fetch(`${API_BASE}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'chainfreight',
      commandId: cmdId(),
      actAs: [asParty],
      commands
    })
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
    fields
  }
}