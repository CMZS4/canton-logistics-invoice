const STORAGE_KEY = 'chainfreight_events_v1'

export function logEvent(contractId, eventType, actor, details = {}) {
  try {
    const events = getEvents()
    const event = {
      contractId,
      eventType,
      actor,
      details,
      timestamp: new Date().toISOString(),
    }
    events.push(event)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // ignore
  }
}

export function getEvents(contractId = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const events = raw ? JSON.parse(raw) : []
    if (contractId) {
      return events.filter(e => e.contractId === contractId)
    }
    return events
  } catch {
    return []
  }
}

export function clearEvents() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export const EVENT_LABELS = {
  PROPOSAL_CREATED:  '📋 Shipment proposal created',
  PROPOSAL_ACCEPTED: '✅ Proposal accepted by carrier',
  PROPOSAL_REJECTED: '❌ Proposal rejected by carrier',
  INVOICE_CREATED:   '💰 Invoice issued',
  DISPUTE_RAISED:    '⚠️ Dispute raised by shipper',
  CLAIM_ACCEPTED:    '✅ Dispute claim accepted — reduced invoice issued',
  CLAIM_REJECTED:    '❌ Dispute claim rejected — original amount stands',
  INVOICE_PAID:      '💳 Invoice marked as paid',
}
export function setWorkflowId(id) {
  try { localStorage.setItem('chainfreight_workflow_id', id) } catch {}
}

export function getWorkflowId() {
  try { return localStorage.getItem('chainfreight_workflow_id') } catch { return null }
}