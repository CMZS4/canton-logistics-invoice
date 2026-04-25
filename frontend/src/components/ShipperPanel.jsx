import { useState } from 'react'

// ═══════════════════════════════════════════════════════════
// SHIPPER PANEL
// ═══════════════════════════════════════════════════════════
// Shipper-only view: create shipment proposals with structured
// freight details, and see the ones still pending acceptance.
// ═══════════════════════════════════════════════════════════

export default function ShipperPanel({ proposals, onCreate, loading }) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [cargoType, setCargoType] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [price, setPrice] = useState('')
  const [details, setDetails] = useState('')

  const handleSubmit = () => {
    if (!origin || !destination || !cargoType || !weightKg || !price) return
    onCreate({
      origin,
      destination,
      cargoType,
      weightKg: parseFloat(weightKg),
      price: parseFloat(price),
      details: details || `${cargoType} from ${origin} to ${destination}`
    })
    setOrigin('')
    setDestination('')
    setCargoType('')
    setWeightKg('')
    setPrice('')
    setDetails('')
  }

  return (
    <div className="panel">
      <h2>Create New Shipment Proposal</h2>
      <div className="form-grid">
        <input
          type="text"
          placeholder="Origin (e.g. Istanbul)"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Destination (e.g. Ankara)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Cargo type (e.g. Electronics)"
          value={cargoType}
          onChange={(e) => setCargoType(e.target.value)}
          disabled={loading}
        />
        <input
          type="number"
          placeholder="Weight (kg)"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          disabled={loading}
        />
        <input
          type="number"
          placeholder="Price (USD)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={loading}
        />
        <button
          className="form-submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Submitting…' : 'Send Proposal'}
        </button>
      </div>

      <h3>My Pending Proposals ({proposals.length})</h3>
      <div className="list">
        {proposals.length === 0 && <p className="empty">No proposals yet.</p>}
        {proposals.map(p => (
          <div key={p.contractId} className="card pending">
            <div className="card-header">
              <strong>{p.fields.origin} → {p.fields.destination}</strong>
              <span className="badge">⏳ Pending</span>
            </div>
            <p className="card-meta">
              <span className="meta-pill">{p.fields.cargoType}</span>
              <span className="meta-pill">{parseFloat(p.fields.weightKg).toFixed(0)} kg</span>
            </p>
            <p>Carrier: FastFreight Ltd.</p>
            <p>Price: ${parseFloat(p.fields.price).toLocaleString('en-US')}</p>
            {p.fields.details && p.fields.details !== `${p.fields.cargoType} from ${p.fields.origin} to ${p.fields.destination}` && (
              <p className="card-notes">"{p.fields.details}"</p>
            )}
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}…</p>
          </div>
        ))}
      </div>
    </div>
  )
}