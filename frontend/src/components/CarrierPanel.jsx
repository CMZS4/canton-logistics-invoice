// ═══════════════════════════════════════════════════════════
// CARRIER PANEL
// ═══════════════════════════════════════════════════════════
// Carrier-only view: shows incoming proposals (Accept/Reject)
// and active shipments (with Create Invoice action).
// ═══════════════════════════════════════════════════════════

import { currencySymbol } from '../lib/ledger'
import ContractModal from './ContractModal'
import { useState } from 'react'

export default function CarrierPanel({
  proposals,
  shipments,
  onAccept,
  onReject,
  onCreateInvoice,
  loading
}) {
  const [selectedContract, setSelectedContract] = useState(null)

  return (
    <div className="panel">
      {selectedContract && (
        <ContractModal
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
      <h2>Incoming Proposals ({proposals.length})</h2>
      <div className="list">
        {proposals.length === 0 && <p className="empty">No pending proposals.</p>}
        {proposals.map(p => (
          <div key={p.contractId} className="card pending">
            <div className="card-header">
              <strong>{p.fields.origin} → {p.fields.destination}</strong>
              <span className="badge">⏳ New</span>
            </div>
            <p className="card-meta">
              <span className="meta-pill">{p.fields.cargoType}</span>
              <span className="meta-pill">{parseFloat(p.fields.weightKg).toFixed(0)} kg</span>
            </p>
            <p>Shipper: Murat Logistics Inc.</p>
            <p>Price: {currencySymbol(p.fields.currency)}{parseFloat(p.fields.price).toLocaleString('en-US')}</p>
            {p.fields.details && (
              <p className="card-notes">"{p.fields.details}"</p>
            )}
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}…</p>
            <button
              className="btn-details"
              onClick={() => setSelectedContract(p)}
            >
              🔍 View contract details
            </button>
            <div className="card-actions">
              <button
                onClick={() => onAccept(p.contractId)}
                disabled={loading}
              >
                {loading ? 'Processing…' : '✅ Accept'}
              </button>
              <button
                className="btn-danger"
                onClick={() => onReject(p.contractId)}
                disabled={loading}
              >
                {loading ? '…' : '❌ Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2>Active Shipments ({shipments.length})</h2>
      <div className="list">
        {shipments.length === 0 && <p className="empty">No active shipments.</p>}
        {shipments.map(s => (
          <div key={s.contractId} className="card active">
            <div className="card-header">
              <strong>{s.fields.origin} → {s.fields.destination}</strong>
              <span className="badge success">✅ Accepted</span>
            </div>
            <p className="card-meta">
              <span className="meta-pill">{s.fields.cargoType}</span>
              <span className="meta-pill">{s.fields.weightKg} kg</span>
            </p>
            <p>Shipper: Murat Logistics Inc.</p>
            <p>Amount: {currencySymbol(s.fields.currency)}{parseFloat(s.fields.price).toLocaleString('en-US')}</p>
            <p className="ledger-id">⛓ Contract: {s.contractId.slice(0, 20)}…</p>
            <button
              className="btn-details"
              onClick={() => setSelectedContract(s)}
            >
              🔍 View contract details
            </button>
            <button onClick={() => onCreateInvoice(s.contractId)} disabled={loading}>
              {loading ? 'Processing…' : '📄 Create Invoice'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}