import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'

import {
  fetchParties,
  queryContracts,
  submitCommand,
  parseContract,
  isMockMode
} from './lib/ledger'

import RoleSelector from './components/RoleSelector'
import ShipperPanel from './components/ShipperPanel'
import CarrierPanel from './components/CarrierPanel'
import InvoicePanel from './components/InvoicePanel'
import Dashboard from './components/Dashboard'
import DisputePanel from './components/DisputePanel'

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

  async function createProposal(input) {
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
            origin: input.origin,
            destination: input.destination,
            cargoType: input.cargoType,
            weightKg: input.weightKg.toString(),
            price: input.price.toString(),
            currency: input.currency || 'USD',
            details: input.details,
            createdAt: new Date().toISOString()
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

  async function rejectProposal(contractId) {
    setLoading(true)
    const t = toast.loading('Rejecting proposal…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:ShipmentProposal',
          contractId,
          choice: 'Reject',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Proposal rejected', { id: t })
    } catch (e) {
      toast.error(`Reject failed: ${e.message}`, { id: t })
      setError(`Reject failed: ${e.message}`)
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

  async function raiseDispute(contractId, reason, claimedAmount) {
    setLoading(true)
    const t = toast.loading('Raising dispute on ledger…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Invoice',
          contractId,
          choice: 'RaiseDispute',
          choiceArgument: {
            reason,
            claimedAmount: claimedAmount.toString()
          }
        }
      }])
      await refresh()
      toast.success('Dispute raised — awaiting carrier response', { id: t })
    } catch (e) {
      toast.error(`Dispute failed: ${e.message}`, { id: t })
      setError(`Dispute failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function acceptClaim(contractId) {
    setLoading(true)
    const t = toast.loading('Accepting claim — issuing reduced invoice…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Dispute',
          contractId,
          choice: 'AcceptClaim',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Claim accepted — reduced invoice issued', { id: t })
    } catch (e) {
      toast.error(`Accept claim failed: ${e.message}`, { id: t })
      setError(`Accept claim failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function rejectClaim(contractId) {
    setLoading(true)
    const t = toast.loading('Rejecting claim — original invoice reissued…')
    try {
      await submitCommand(session.partyId, [{
        ExerciseCommand: {
          templateId: '#chainfreight:Logistics:Dispute',
          contractId,
          choice: 'RejectClaim',
          choiceArgument: {}
        }
      }])
      await refresh()
      toast.success('Claim rejected — original amount stands', { id: t })
    } catch (e) {
      toast.error(`Reject claim failed: ${e.message}`, { id: t })
      setError(`Reject claim failed: ${e.message}`)
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
  const disputes = contracts.filter(c => c.template === 'Dispute')

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
        {isMockMode() ? (
          <div className="ledger-status mock-mode">
            🎬 <strong>Demo Mode</strong> — in-memory simulation for static deploy.
            The same Daml workflow runs against a real Canton ledger when run locally.
          </div>
        ) : (
          <div className="ledger-status">
            🟢 Connected to Canton ledger via JSON API
          </div>
        )}
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
        <button
          className={activeTab === 'dispute' ? 'active' : ''}
          onClick={() => setActiveTab('dispute')}
        >
          ⚠️ Disputes {disputes.length > 0 && <span className="tab-count">{disputes.length}</span>}
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
            onReject={rejectProposal}
            onCreateInvoice={createInvoice}
            loading={loading}
          />
        )}
        {activeTab === 'invoice' && (
          <InvoicePanel
            invoices={invoices}
            isShipper={isShipper}
            onMarkPaid={markPaid}
            onRaiseDispute={raiseDispute}
            loading={loading}
          />
        )}
        {activeTab === 'dispute' && (
          <DisputePanel
            disputes={disputes}
            isShipper={isShipper}
            onAcceptClaim={acceptClaim}
            onRejectClaim={rejectClaim}
            loading={loading}
          />
        )}
      </main>
    </div>
  )
}

export default App