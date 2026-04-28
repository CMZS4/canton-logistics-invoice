// ═══════════════════════════════════════════════════════════
// CONTRACT MODAL
// ═══════════════════════════════════════════════════════════
// Shows full contract details when a card is clicked.
// Demonstrates the tamper-proof nature of Canton contracts:
// - Full contract ID (ledger address)
// - All signatories (who co-signed this state)
// - Complete payload (what was agreed)
// - Template type (which Daml rule governs this contract)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'

const SIGNATORY_LABELS = {
  ShipmentProposal: ['shipper'],
  Shipment: ['shipper', 'carrier'],
  Invoice: ['shipper', 'carrier'],
  Dispute: ['shipper', 'carrier'],
}

const PARTY_DISPLAY = {
  'Shipper::mock-1220abcdef1234567890': 'Murat Logistics Inc. (Shipper)',
  'Carrier::mock-1220fedcba0987654321': 'FastFreight Ltd. (Carrier)',
}

function formatParty(party) {
  return PARTY_DISPLAY[party] || party.slice(0, 32) + '…'
}

function formatValue(key, value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  if (key === 'createdAt') return new Date(value).toLocaleString()
  if (key === 'shipper' || key === 'carrier') return formatParty(value)
  return String(value)
}

const FIELD_LABELS = {
  origin: 'Origin',
  destination: 'Destination',
  cargoType: 'Cargo Type',
  weightKg: 'Weight (kg)',
  price: 'Price',
  amount: 'Amount',
  currency: 'Currency',
  details: 'Details / Notes',
  isPaid: 'Paid',
  originalAmount: 'Original Amount',
  claimedAmount: 'Claimed Amount',
  reason: 'Dispute Reason',
  status: 'Status',
  createdAt: 'Created At',
  shipper: 'Shipper',
  carrier: 'Carrier',
}

const FIELD_ORDER = [
  'shipper', 'carrier', 'origin', 'destination', 'cargoType',
  'weightKg', 'price', 'amount', 'currency', 'details',
  'isPaid', 'originalAmount', 'claimedAmount', 'reason',
  'status', 'createdAt',
]

export default function ContractModal({ contract, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!contract) return null

  const signatoryKeys = SIGNATORY_LABELS[contract.template] || []
  const signatories = signatoryKeys.map(k => contract.fields[k]).filter(Boolean)

  const orderedFields = FIELD_ORDER
    .filter(k => contract.fields[k] !== undefined)
    .map(k => ({ key: k, label: FIELD_LABELS[k] || k, value: contract.fields[k] }))

  function copyId() {
    navigator.clipboard.writeText(contract.contractId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-template-badge">{contract.template}</span>
            <h3 className="modal-title">
              {contract.fields.origin && contract.fields.destination
                ? `${contract.fields.origin} → ${contract.fields.destination}`
                : contract.template}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Contract ID */}
        <div className="modal-section">
          <div className="modal-section-title">⛓ Canton Contract ID</div>
          <div className="modal-contract-id">
            <code>{contract.contractId}</code>
            <button className="copy-btn" onClick={copyId}>
              {copied ? '✅ Copied' : '📋 Copy'}
            </button>
          </div>
          <p className="modal-hint">
            This ID is the ledger address of this contract. Every state
            transition creates a new contract ID — providing a tamper-evident
            audit trail on Canton.
          </p>
        </div>

        {/* Signatories */}
        <div className="modal-section">
          <div className="modal-section-title">✍️ Signatories</div>
          <p className="modal-hint">
            These parties have cryptographically co-signed this contract state.
            No single party can modify it unilaterally.
          </p>
          <div className="modal-signatories">
            {signatories.map((s, i) => (
              <div key={i} className="modal-signatory">
                <span className="signatory-icon">🔐</span>
                <span>{formatParty(s)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="modal-section">
          <div className="modal-section-title">📋 Contract Fields</div>
          <div className="modal-fields">
            {orderedFields.map(({ key, label, value }) => (
              <div key={key} className="modal-field-row">
                <span className="modal-field-label">{label}</span>
                <span className="modal-field-value">{formatValue(key, value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <p className="modal-hint">
            Governed by <strong>Daml template: {contract.template}</strong> —
            business rules enforced cryptographically on Canton Network,
            not by application code.
          </p>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  )
}