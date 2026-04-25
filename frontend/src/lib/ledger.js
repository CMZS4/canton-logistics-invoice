// ═══════════════════════════════════════════════════════════
// CANTON LEDGER API CLIENT
// ═══════════════════════════════════════════════════════════
// All HTTP communication with the Canton JSON Ledger API
// goes through this module. Keeps UI components free of
// fetch logic.
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

export function parseContract(entry) {
  const ev = entry.contractEntry?.JsActiveContract?.createdEvent
  if (!ev) return null
  const templateName = ev.templateId.split(':').pop()
  return {
    contractId: ev.contractId,
    template: templateName,
    fields: ev.createArgument
  }
}