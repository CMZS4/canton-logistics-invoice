import { useState } from 'react'

// ═══════════════════════════════════════════════════════════
// SHIPPER PANEL
// ═══════════════════════════════════════════════════════════
// Shipper-only view: create shipment proposals and see
// the ones still pending acceptance from the carrier.
// ═══════════════════════════════════════════════════════════

export default function ShipperPanel({ proposals, onCreate, loading }) {
  const [details, setDetails] = useState('')
  const [price, setPrice] = useState('')

  const handleSubmit = () => {
    if (!details || !price) return
    onCreate(details, parseFloat(price))
    setDetails('')
    setPrice('')
  }

  return (
    <div className="panel">
      <h2>Create New Shipment Proposal</h2>
      <div className="form">
        <input
          type="text"
          placeholder="Shipment details (e.g. 20ft Container - Istanbul → Ankara)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={loading}
        />
        <input
          type="number"
          placeholder="Price (USD)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={loading}
        />
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting…' : 'Send Proposal'}
        </button>
      </div>

      <h3>My Pending Proposals ({proposals.length})</h3>
      <div className="list">
        {proposals.length === 0 && <p className="empty">No proposals yet.</p>}
        {proposals.map(p => (
          <div key={p.contractId} className="card pending">
            <div className="card-header">
              <strong>{p.fields.details}</strong>
              <span className="badge">⏳ Pending</span>
            </div>
            <p>Carrier: FastFreight Ltd.</p>
            <p>Price: ${parseFloat(p.fields.price).toLocaleString('en-US')}</p>
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}…</p>
          </div>
        ))}
      </div>
    </div>
  )
}