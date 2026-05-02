// ═══════════════════════════════════════════════════════════
// DISPUTE PANEL
// ═══════════════════════════════════════════════════════════
// Both roles see this tab. Shipper sees disputes they raised
// (waiting for carrier to respond). Carrier sees incoming
// disputes and can Accept (reduced invoice) or Reject
// (original amount stands).
// ═══════════════════════════════════════════════════════════

import { currencySymbol } from '../lib/ledger'
import ContractModal from './ContractModal'
import TimelineModal from './TimelineModal'
import { useState } from 'react'

export default function DisputePanel({
  disputes,
  isShipper,
  onAcceptClaim,
  onRejectClaim,
  loading
}) {
  const [selectedContract, setSelectedContract] = useState(null)
  const [timelineContract, setTimelineContract] = useState(null)

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
      <h2>⚠️ Disputes ({disputes.length})</h2>
      <p className="dash-sub">
        {isShipper
          ? 'Disputes you raised. Awaiting carrier resolution.'
          : 'Disputes raised against your invoices. You can accept the reduced settlement or reject the claim.'}
      </p>

      <div className="list">
        {disputes.length === 0 && (
          <p className="empty">No active disputes.</p>
        )}
        {disputes.map(d => {
          const original = parseFloat(d.fields.originalAmount)
          const claimed = parseFloat(d.fields.claimedAmount)
          const reduction = original - claimed
          const reductionPct = original > 0
            ? ((reduction / original) * 100).toFixed(0)
            : '0'

          return (
            <div key={d.contractId} className="card dispute">
              <div className="card-header">
                <strong>{d.fields.origin} → {d.fields.destination}</strong>
                <span className="badge dispute-badge">⚠️ {d.fields.status}</span>
              </div>

              <p className="card-meta">
                <span className="meta-pill">{d.fields.cargoType}</span>
                <span className="meta-pill">−{reductionPct}% claim</span>
              </p>

              <div className="dispute-amounts">
                <div className="dispute-amount-row">
                  <span className="amount-label">Original invoice</span>
                  <span className="amount-strikethrough">
                    {currencySymbol(d.fields.currency)}{original.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="dispute-amount-row">
                  <span className="amount-label">Shipper claims</span>
                  <span className="amount-claim">
                    {currencySymbol(d.fields.currency)}{claimed.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="dispute-amount-row reduction-row">
                  <span className="amount-label">Disputed reduction</span>
                  <span className="amount-reduction">
                    −{currencySymbol(d.fields.currency)}{reduction.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <p className="dispute-reason">
                <strong>Reason:</strong> "{d.fields.reason}"
              </p>

              <p className="ledger-id">⛓ Contract: {d.contractId.slice(0, 20)}…</p>
              <button
                className="btn-details"
                onClick={() => setSelectedContract(d)}
              >
                🔍 View contract details
              </button>
              <button
                className="btn-timeline"
                onClick={() => setTimelineContract(d)}
              >
                📜 View timeline
              </button>

              {!isShipper && (
                <div className="card-actions">
                  <button
                    onClick={() => onAcceptClaim(d.contractId)}
                    disabled={loading}
                  >
                    {loading ? 'Processing…' : '✅ Accept claim'}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => onRejectClaim(d.contractId)}
                    disabled={loading}
                  >
                    {loading ? '…' : '❌ Reject claim'}
                  </button>
                </div>
              )}

              {isShipper && (
                <p className="empty" style={{ textAlign: 'left' }}>
                  Waiting for carrier to accept or reject your claim…
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}