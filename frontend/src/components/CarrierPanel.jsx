// ═══════════════════════════════════════════════════════════
// CARRIER PANEL
// ═══════════════════════════════════════════════════════════
// Carrier-only view: shows incoming proposals (with Accept
// action) and active shipments (with Create Invoice action).
// ═══════════════════════════════════════════════════════════

export default function CarrierPanel({ proposals, shipments, onAccept, onCreateInvoice, loading }) {
  return (
    <div className="panel">
      <h2>Incoming Proposals ({proposals.length})</h2>
      <div className="list">
        {proposals.length === 0 && <p className="empty">No pending proposals.</p>}
        {proposals.map(p => (
          <div key={p.contractId} className="card pending">
            <div className="card-header">
              <strong>{p.fields.details}</strong>
              <span className="badge">⏳ New</span>
            </div>
            <p>Shipper: Murat Logistics Inc.</p>
            <p>Price: ${parseFloat(p.fields.price).toLocaleString('en-US')}</p>
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}…</p>
            <button onClick={() => onAccept(p.contractId)} disabled={loading}>
              {loading ? 'Processing…' : '✅ Accept'}
            </button>
          </div>
        ))}
      </div>

      <h2>Active Shipments ({shipments.length})</h2>
      <div className="list">
        {shipments.length === 0 && <p className="empty">No active shipments.</p>}
        {shipments.map(s => (
          <div key={s.contractId} className="card active">
            <div className="card-header">
              <strong>{s.fields.details}</strong>
              <span className="badge success">✅ Accepted</span>
            </div>
            <p>Shipper: Murat Logistics Inc.</p>
            <p>Amount: ${parseFloat(s.fields.price).toLocaleString('en-US')}</p>
            <p className="ledger-id">⛓ Contract: {s.contractId.slice(0, 20)}…</p>
            <button onClick={() => onCreateInvoice(s.contractId)} disabled={loading}>
              {loading ? 'Processing…' : '📄 Create Invoice'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}