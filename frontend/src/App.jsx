import { useState, useEffect } from 'react'
import './App.css'
import toast, { Toaster } from 'react-hot-toast'
// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════

const API_BASE = ''
const STORAGE_KEY = 'chainfreight_role'

// ═══════════════════════════════════════════════════════════
// LEDGER API CLIENT
// ═══════════════════════════════════════════════════════════

const cmdId = () => `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function fetchParties() {
  const res = await fetch(`${API_BASE}/v2/parties`)
  const data = await res.json()
  return data.partyDetails || []
}

async function getLedgerEnd() {
  const res = await fetch(`${API_BASE}/v2/state/ledger-end`)
  const data = await res.json()
  return data.offset
}

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

// Short display name from party ID
function shortenParty(partyId) {
  if (!partyId) return ''
  const [hint] = partyId.split('::')
  return hint
}

// ═══════════════════════════════════════════════════════════
// ROLE SELECTOR (login screen)
// ═══════════════════════════════════════════════════════════

function RoleSelector({ onSelect }) {
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchParties()
      .then(list => {
        // filter out system party (starts with "sandbox::")
        const user = list.filter(p => !p.party.startsWith('sandbox::'))
        setParties(user)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const byHint = (hint) => parties.find(p => p.party.startsWith(hint + '::'))

  const shipper = byHint('Shipper')
  const carrier = byHint('Carrier')

  return (
    <div className="role-screen">
      <div className="role-box">
        <h1>⚓ ChainFreight</h1>
        <p className="role-sub">Select your role to continue</p>

        {loading && <p className="empty">Loading parties from ledger…</p>}
        {error && <div className="error-banner">Could not reach ledger: {error}</div>}

        {!loading && !error && (
          <>
            {(!shipper || !carrier) && (
              <div className="error-banner">
                Parties not found. Run the setup curl commands from README first.
              </div>
            )}

            <div className="role-cards">
              <button
                className="role-card"
                disabled={!shipper}
                onClick={() => shipper && onSelect({ role: 'shipper', partyId: shipper.party })}
              >
                <div className="role-icon">🏢</div>
                <div className="role-title">Shipper</div>
                <div className="role-company">Murat Logistics Inc.</div>
                <div className="role-id">
                  {shipper ? `ID: ${shipper.party.slice(0, 24)}…` : 'Not provisioned'}
                </div>
              </button>

              <button
                className="role-card"
                disabled={!carrier}
                onClick={() => carrier && onSelect({ role: 'carrier', partyId: carrier.party })}
              >
                <div className="role-icon">🚚</div>
                <div className="role-title">Carrier</div>
                <div className="role-company">FastFreight Ltd.</div>
                <div className="role-id">
                  {carrier ? `ID: ${carrier.party.slice(0, 24)}…` : 'Not provisioned'}
                </div>
              </button>
            </div>
          </>
        )}

        <div className="ledger-status" style={{ marginTop: '24px' }}>
          🟢 Connected to Canton ledger via JSON API
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════

function App() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [counterparty, setCounterparty] = useState(null)
  const [activeTab, setActiveTab] = useState('main')
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Persist session
  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  }, [session])

  // Resolve counterparty from ledger whenever role changes
  useEffect(() => {
    if (!session) return
    fetchParties().then(list => {
      const other = list.find(p => {
        const wantedHint = session.role === 'shipper' ? 'Carrier' : 'Shipper'
        return p.party.startsWith(wantedHint + '::')
      })
      if (other) setCounterparty(other.party)
    })
  }, [session])

  // Refresh active contracts
  async function refresh() {
    if (!session) return
    try {
      setError(null)
      const data = await queryContracts(session.partyId)
      setContracts(data.map(parseContract).filter(Boolean))
    } catch (e) {
      setError(`Ledger error: ${e.message}`)
    }
  }

  useEffect(() => {
    if (!session) return
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [session])

  // ─── ACTIONS ──────────────────────────────────────────────

  async function createProposal(details, price) {
    if (!counterparty) {
      toast.error('Carrier not found on ledger')
      return
    }
    setLoading(true)
    const t = toast.loading('Creating proposal on ledger…')
    try {
      await submitCommand(session.partyId, [{
        CreateCommand: {
          templateId: '#chainfreight:Logistics:ShipmentProposal',
          createArguments: {
            shipper: session.partyId,
            carrier: counterparty,
            details,
            price: price.toString()
          }
        }
      }])
      await refresh()
      toast.success('Proposal created on ledger', { id: t })
    } catch (e) {
      toast.error(`Create failed: ${e.message}`, { id: t })
      setError(`Create failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function acceptProposal(contractId) {
    setLoading(true)
    const t = toast.loading('Accepting proposal…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:ShipmentProposal',
          contractId,
          choice: 'Accept',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Shipment accepted — contract created', { id: t })
    } catch (e) {
      toast.error(`Accept failed: ${e.message}`, { id: t })
      setError(`Accept failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

async function createInvoice(contractId) {
    setLoading(true)
    const t = toast.loading('Creating invoice on ledger…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Shipment',
          contractId,
          choice: 'CreateInvoice',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Invoice created', { id: t })
    } catch (e) {
      toast.error(`Create invoice failed: ${e.message}`, { id: t })
      setError(`Create invoice failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

async function markPaid(contractId) {
    setLoading(true)
    const t = toast.loading('Marking invoice as paid…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Invoice',
          contractId,
          choice: 'MarkPaid',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Invoice marked as paid ✓', { id: t })
    } catch (e) {
      toast.error(`Mark paid failed: ${e.message}`, { id: t })
      setError(`Mark paid failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

function logout() {
    setSession(null)
    setContracts([])
    setCounterparty(null)
    setError(null)
    toast.success('Switched out — choose a new role')
  }

  // ─── RENDER ───────────────────────────────────────────────

  if (!session) {
    return (
      <RoleSelector
        onSelect={(s) => { setSession(s); setActiveTab('main') }}
      />
    )
  }

  // Filter contracts by role
  const proposals = contracts.filter(c => c.template === 'ShipmentProposal')
  const shipments = contracts.filter(c => c.template === 'Shipment')
  const invoices = contracts.filter(c => c.template === 'Invoice')

  const isShipper = session.role === 'shipper'
  const roleLabel = isShipper ? '🏢 Shipper — Murat Logistics' : '🚚 Carrier — FastFreight'

  return (
    <div className="app">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.2)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
            duration: 5000,
          },
        }}
      />
      <header>
        <div className="header-row">
          <div>
            <h1>⚓ ChainFreight</h1>
            <p>Live on Canton Network — tamper-proof shipment & invoice workflow</p>
          </div>
          <div className="session-box">
            <div className="session-role">{roleLabel}</div>
            <button className="logout-btn" onClick={logout}>Switch role</button>
          </div>
        </div>
        <div className="ledger-status">
          🟢 Connected to Canton ledger via JSON API
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <nav className="tabs">
        <button
          className={activeTab === 'main' ? 'active' : ''}
          onClick={() => setActiveTab('main')}
        >
          {isShipper ? '🏢 My Shipments' : '🚚 Incoming & Active'}
        </button>
        <button
          className={activeTab === 'invoice' ? 'active' : ''}
          onClick={() => setActiveTab('invoice')}
        >
          💰 Invoices
        </button>
      </nav>

      <main>
        {activeTab === 'main' && isShipper && (
          <ShipperPanel
            proposals={proposals}
            onCreate={createProposal}
            loading={loading}
          />
        )}
        {activeTab === 'main' && !isShipper && (
          <CarrierPanel
            proposals={proposals}
            shipments={shipments}
            onAccept={acceptProposal}
            onCreateInvoice={createInvoice}
            loading={loading}
          />
        )}
        {activeTab === 'invoice' && (
          <InvoicePanel
            invoices={invoices}
            isShipper={isShipper}
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

// ═══════════════════════════════════════════════════════════
// INVOICE PANEL
// ═══════════════════════════════════════════════════════════

function InvoicePanel({ invoices, isShipper, onMarkPaid, loading }) {
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

export default App