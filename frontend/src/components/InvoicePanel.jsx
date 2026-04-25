// ═══════════════════════════════════════════════════════════
// INVOICE PANEL
// ═══════════════════════════════════════════════════════════
// Shared view for both roles. Mark-as-paid action is only
// rendered for the Shipper — the Carrier sees a waiting
// state, mirroring the on-ledger choice controller.
// ═══════════════════════════════════════════════════════════

export default function InvoicePanel({ invoices, isShipper, onMarkPaid, loading }) {
  return (
    <div className="panel">
      <h2>Invoices ({invoices.length})</h2>
      <div className="list">
        {invoices.length === 0 && <p className="empty">No invoices yet.</p>}
        {invoices.map(inv => {
          const paid = inv.fields.isPaid === true || inv.fields.isPaid === 'true'
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
                <span className="meta-pill">{parseFloat(inv.fields.weightKg).toFixed(0)} kg</span>
              </p>
              <p>Shipper: Murat Logistics Inc.</p>
              <p>Carrier: FastFreight Ltd.</p>
              <p className="amount">${parseFloat(inv.fields.amount).toLocaleString('en-US')}</p>
              {inv.fields.details && (
                <p className="card-notes">"{inv.fields.details}"</p>
              )}
              <p className="ledger-id">⛓ Contract: {inv.contractId.slice(0, 20)}…</p>
              {!paid && isShipper && (
                <button onClick={() => onMarkPaid(inv.contractId)} disabled={loading}>
                  {loading ? 'Processing…' : '💳 Mark as Paid'}
                </button>
              )}
              {!paid && !isShipper && (
                <p className="empty" style={{ textAlign: 'left' }}>
                  Waiting for Shipper to pay…
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}