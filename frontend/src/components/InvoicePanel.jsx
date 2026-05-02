import { useState } from 'react'
import { currencySymbol } from '../lib/ledger'
import ContractModal from './ContractModal'
import TimelineModal from './TimelineModal'

// ═══════════════════════════════════════════════════════════
// INVOICE PANEL
// ═══════════════════════════════════════════════════════════
// Shared view for both roles. Shipper can either Mark as Paid
// or Raise a Dispute. Carrier sees the waiting state.
// ═══════════════════════════════════════════════════════════

export default function InvoicePanel({
  invoices,
  isShipper,
  onMarkPaid,
  onRaiseDispute,
  loading
}) {
  const [selectedContract, setSelectedContract] = useState(null)
  const [timelineContract, setTimelineContract] = useState(null)
  const [disputingId, setDisputingId] = useState(null)
  const [reason, setReason] = useState('')
  const [claimedAmount, setClaimedAmount] = useState('')

  function startDispute(contractId) {
    setDisputingId(contractId)
    setReason('')
    setClaimedAmount('')
  }

  function cancelDispute() {
    setDisputingId(null)
    setReason('')
    setClaimedAmount('')
  }

  function submitDispute(invoice) {
    if (!reason.trim() || !claimedAmount) return
    const amt = parseFloat(claimedAmount)
    if (amt <= 0 || amt > parseFloat(invoice.fields.amount)) return
    onRaiseDispute(invoice.contractId, reason.trim(), amt)
    cancelDispute()
  }

  return (
    <div className="panel">
      {selectedContract && (
        <ContractModal
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
      {timelineContract && (
        <TimelineModal
          contract={timelineContract}
          onClose={() => setTimelineContract(null)}
        />
      )}
      <h2>Invoices ({invoices.length})</h2>
      <div className="list">
        {invoices.length === 0 && <p className="empty">No invoices yet.</p>}
        {invoices.map(inv => {
          const paid = inv.fields.isPaid === true || inv.fields.isPaid === 'true'
          const isDisputingThis = disputingId === inv.contractId
          const fullAmount = parseFloat(inv.fields.amount)

          return (
            <div key={inv.contractId} className={`card ${paid ? 'paid' : 'unpaid'}`}>
              <div className="card-header">
                <strong>{inv.fields.origin} → {inv.fields.destination}</strong>
                <span className={`badge ${paid ? 'success' : 'warning'}`}>
                  {paid ? '✅ Paid' : '⏳ Pending'}
                </span>
              </div>
              <p className="card-meta">
                <span className="meta-pill">{inv.fields.cargoType}</span>
                {inv.fields.weightKg && parseFloat(inv.fields.weightKg) > 0 && (
                  <span className="meta-pill">
                    {parseFloat(inv.fields.weightKg).toFixed(0)} kg
                  </span>
                )}
              </p>
              <p>Shipper: Murat Logistics Inc.</p>
              <p>Carrier: FastFreight Ltd.</p>
              <p className="amount">{currencySymbol(inv.fields.currency)}{fullAmount.toLocaleString('en-US')}</p>
              {inv.fields.details && (
                <p className="card-notes">"{inv.fields.details}"</p>
              )}
              <p className="ledger-id">⛓ Contract: {inv.contractId.slice(0, 20)}…</p>
              <button
                className="btn-details"
                onClick={() => setSelectedContract(inv)}
              >
                🔍 View contract details
              </button>
              <button
                className="btn-timeline"
                onClick={() => setTimelineContract(inv)}
              >
                📜 View timeline
              </button>

              {/* Action area */}
              {!paid && isShipper && !isDisputingThis && (
                <div className="card-actions">
                  <button
                    onClick={() => onMarkPaid(inv.contractId)}
                    disabled={loading}
                  >
                    {loading ? 'Processing…' : '💳 Mark as Paid'}
                  </button>
                  <button
                    className="btn-warning"
                    onClick={() => startDispute(inv.contractId)}
                    disabled={loading}
                  >
                    ⚠️ Raise Dispute
                  </button>
                </div>
              )}

              {/* Dispute form (inline, expanded) */}
              {!paid && isShipper && isDisputingThis && (
                <div className="dispute-form">
                  <h4>Raise a dispute</h4>
                  <input
                    type="text"
                    placeholder="Reason (e.g. 30% damaged on arrival)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="number"
                    placeholder={`Claimed amount (max ${currencySymbol(inv.fields.currency)}${fullAmount.toLocaleString('en-US')})`}
                    value={claimedAmount}
                    onChange={(e) => setClaimedAmount(e.target.value)}
                    disabled={loading}
                    max={fullAmount}
                    min={0.01}
                    step={0.01}
                  />
                  <p className="dispute-hint">
                    The carrier will be asked to accept (reduced invoice issued)
                    or reject (original amount stands).
                  </p>
                  <div className="card-actions">
                    <button
                      className="btn-warning"
                      onClick={() => submitDispute(inv)}
                      disabled={loading || !reason.trim() || !claimedAmount}
                    >
                      {loading ? 'Submitting…' : 'Submit dispute'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={cancelDispute}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!paid && !isShipper && (
                <p className="empty" style={{ textAlign: 'left' }}>
                  Waiting for Shipper to pay or raise a dispute…
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}