import { useState, useEffect } from 'react'
import './App.css'

// ═══════════════════════════════════════════════════════════
// CANTON LEDGER CONFIG
// ═══════════════════════════════════════════════════════════

const API_BASE = ''

const SHIPPER = 'Shipper::12207e3a535ddc13b2b1c12be49f6657791b74184f3eebc4ddecd3a9d7f6d83f87ed'
const CARRIER = 'Carrier::12207e3a535ddc13b2b1c12be49f6657791b74184f3eebc4ddecd3a9d7f6d83f87ed'

// ═══════════════════════════════════════════════════════════
// LEDGER API CLIENT
// ═══════════════════════════════════════════════════════════

// Generate unique command ID
const cmdId = () => `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Get latest ledger offset
async function getLedgerEnd() {
  const res = await fetch(`${API_BASE}/v2/state/ledger-end`)
  const data = await res.json()
  return data.offset
}

// Query active contracts as a given party
async function queryContracts(asParty) {
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

// Submit a command (create or exercise)
async function submitCommand(asParty, commands) {
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

// Parse ledger contract into friendly UI object
function parseContract(entry) {
  const ev = entry.contractEntry?.JsActiveContract?.createdEvent
  if (!ev) return null
  const templateName = ev.templateId.split(':').pop()
  return {
    contractId: ev.contractId,
    template: templateName,
    fields: ev.createArgument
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════

function App() {
  const [activeTab, setActiveTab] = useState('shipper')
  const [shipperContracts, setShipperContracts] = useState([])
  const [carrierContracts, setCarrierContracts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch contracts from ledger
  async function refresh() {
    try {
      setError(null)
      const [sData, cData] = await Promise.all([
        queryContracts(SHIPPER),
        queryContracts(CARRIER)
      ])
      setShipperContracts(sData.map(parseContract).filter(Boolean))
      setCarrierContracts(cData.map(parseContract).filter(Boolean))
    } catch (e) {
      setError(`Ledger error: ${e.message}`)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  // ─── ACTIONS ──────────────────────────────────────────────

  async function createProposal(details, price) {
    setLoading(true)
    try {
      await submitCommand(SHIPPER, [{
        CreateCommand: {
          templateId: '#chainfreight:Logistics:ShipmentProposal',
          createArguments: {
            shipper: SHIPPER,
            carrier: CARRIER,
            details,
            price: price.toString()
          }
        }
      }])
      await refresh()
    } catch (e) {
      setError(`Create failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function acceptProposal(contractId) {
    setLoading(true)
    try {
      await submitCommand(CARRIER, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:ShipmentProposal',
          contractId,
          choice: 'Accept',
          choiceArgument: {}
        }
      }])
      await refresh()
    } catch (e) {
      setError(`Accept failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function createInvoice(contractId) {
    setLoading(true)
    try {
      await submitCommand(CARRIER, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Shipment',
          contractId,
          choice: 'CreateInvoice',
          choiceArgument: {}
        }
      }])
      await refresh()
    } catch (e) {
      setError(`Create invoice failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function markPaid(contractId) {
    setLoading(true)
    try {
      await submitCommand(SHIPPER, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Invoice',
          contractId,
          choice: 'MarkPaid',
          choiceArgument: {}
        }
      }])
      await refresh()
    } catch (e) {
      setError(`Mark paid failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ─── FILTER CONTRACTS ─────────────────────────────────────

  const proposals = shipperContracts.filter(c => c.template === 'ShipmentProposal')
  const proposalsForCarrier = carrierContracts.filter(c => c.template === 'ShipmentProposal')
  const shipments = carrierContracts.filter(c => c.template === 'Shipment')
  const invoices = shipperContracts.filter(c => c.template === 'Invoice')

  // ─── RENDER ───────────────────────────────────────────────

  return (
    <div className="app">
      <header>
        <h1>⚓ ChainFreight</h1>
        <p>Live on Canton Network — tamper-proof shipment & invoice workflow</p>
        <div className="ledger-status">
          🟢 Connected to Canton ledger via JSON API
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <nav className="tabs">
        <button
          className={activeTab === 'shipper' ? 'active' : ''}
          onClick={() => setActiveTab('shipper')}
        >
          🏢 Shipper Dashboard
        </button>
        <button
          className={activeTab === 'carrier' ? 'active' : ''}
          onClick={() => setActiveTab('carrier')}
        >
          🚚 Carrier Dashboard
        </button>
        <button
          className={activeTab === 'invoice' ? 'active' : ''}
          onClick={() => setActiveTab('invoice')}
        >
          💰 Invoices
        </button>
      </nav>

      <main>
        {activeTab === 'shipper' && (
          <ShipperPanel
            proposals={proposals}
            onCreate={createProposal}
            loading={loading}
          />
        )}
        {activeTab === 'carrier' && (
          <CarrierPanel
            proposals={proposalsForCarrier}
            shipments={shipments}
            onAccept={acceptProposal}
            onCreateInvoice={createInvoice}
            loading={loading}
          />
        )}
        {activeTab === 'invoice' && (
          <InvoicePanel
            invoices={invoices}
            onMarkPaid={markPaid}
            loading={loading}
          />
        )}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SHIPPER PANEL
// ═══════════════════════════════════════════════════════════

function ShipperPanel({ proposals, onCreate, loading }) {
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
          {loading ? 'Submitting...' : 'Send Proposal'}
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
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}...</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CARRIER PANEL
// ═══════════════════════════════════════════════════════════

function CarrierPanel({ proposals, shipments, onAccept, onCreateInvoice, loading }) {
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
            <p className="ledger-id">⛓ Contract: {p.contractId.slice(0, 20)}...</p>
            <button onClick={() => onAccept(p.contractId)} disabled={loading}>
              {loading ? 'Processing...' : '✅ Accept'}
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
            <p className="ledger-id">⛓ Contract: {s.contractId.slice(0, 20)}...</p>
            <button onClick={() => onCreateInvoice(s.contractId)} disabled={loading}>
              {loading ? 'Processing...' : '📄 Create Invoice'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// INVOICE PANEL
// ═══════════════════════════════════════════════════════════

function InvoicePanel({ invoices, onMarkPaid, loading }) {
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
                <strong>{inv.fields.details}</strong>
                <span className={`badge ${paid ? 'success' : 'warning'}`}>
                  {paid ? '✅ Paid' : '⏳ Pending'}
                </span>
              </div>
              <p>Shipper: Murat Logistics Inc.</p>
              <p>Carrier: FastFreight Ltd.</p>
              <p className="amount">${parseFloat(inv.fields.amount).toLocaleString('en-US')}</p>
              <p className="ledger-id">⛓ Contract: {inv.contractId.slice(0, 20)}...</p>
              {!paid && (
                <button onClick={() => onMarkPaid(inv.contractId)} disabled={loading}>
                  {loading ? 'Processing...' : '💳 Mark as Paid'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default App