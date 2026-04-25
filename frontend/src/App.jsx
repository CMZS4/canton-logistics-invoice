import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'

import {
  fetchParties,
  queryContracts,
  submitCommand,
  parseContract
} from './lib/ledger'

import RoleSelector from './components/RoleSelector'
import ShipperPanel from './components/ShipperPanel'
import CarrierPanel from './components/CarrierPanel'
import InvoicePanel from './components/InvoicePanel'
import Dashboard from './components/Dashboard'

const STORAGE_KEY = 'chainfreight_role'

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
// Holds the session, polls the ledger, and routes actions
// through the appropriate role panel. All ledger primitives
// live in lib/ledger.js; UI lives in components/.
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
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
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
        {activeTab === 'dashboard' && (
          <Dashboard contracts={contracts} />
        )}
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

export default App