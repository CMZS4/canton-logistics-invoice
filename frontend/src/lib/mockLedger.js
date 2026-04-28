// ═══════════════════════════════════════════════════════════
// MOCK LEDGER — In-memory simulation for static deploys
// ═══════════════════════════════════════════════════════════
//
// This module mirrors the real ledger.js API but stores
// contracts in memory instead of calling the Canton JSON API.
// Used when VITE_MOCK_MODE=true (e.g. on Vercel where the
// sandbox isn't reachable).
//
// The state machine logic (consuming choices, signatory
// rules) is reproduced here for demo purposes — in production
// the real ledger enforces all of this cryptographically.
// ═══════════════════════════════════════════════════════════

// ─── Persistence layer ────────────────────────────────────
// Mock state persists to localStorage so jury/users can refresh
// the page without losing the workflow they built up. State
// resets only on explicit "reset" or by clearing browser storage.
const STORAGE_KEY = 'chainfreight_mock_ledger_v1'

// Sample seed data so the app isn't empty on first visit.
// Demonstrates an active shipment + an unpaid invoice already
// in flight — gives the jury a populated view immediately.
const SEED_CONTRACTS = () => [
  {
    contractId: 'mock-seed-shipment-1',
    template: 'Shipment',
    payload: {
      shipper: 'Shipper::mock-1220abcdef1234567890',
      carrier: 'Carrier::mock-1220fedcba0987654321',
      origin: 'Istanbul',
      destination: 'Ankara',
      cargoType: 'Electronics',
      weightKg: '800',
      price: '4500',
      details: '20ft container, urgent route',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  },
  {
    contractId: 'mock-seed-invoice-1',
    template: 'Invoice',
    payload: {
      shipper: 'Shipper::mock-1220abcdef1234567890',
      carrier: 'Carrier::mock-1220fedcba0987654321',
      origin: 'Izmir',
      destination: 'Bursa',
      cargoType: 'Textiles',
      weightKg: '300',
      amount: '2000',
      details: 'Bi-weekly textile delivery',
      isPaid: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  },
]

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { contracts: SEED_CONTRACTS(), counter: 100 }
    const parsed = JSON.parse(raw)
    if (!parsed.contracts || parsed.contracts.length === 0) {
      return { contracts: SEED_CONTRACTS(), counter: parsed.counter || 100 }
    }
    return {
      contracts: parsed.contracts,
      counter: parsed.counter || 100,
    }
  } catch {
    return { contracts: SEED_CONTRACTS(), counter: 100 }
  }
}

const initial = loadState()
let contractIdCounter = initial.counter
const generateCid = () => `mock-cid-${contractIdCounter++}`

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      contracts: activeContracts,
      counter: contractIdCounter,
    }))
  } catch {
    // localStorage full or disabled — silently fail, mock still works in memory
  }
}

// ─── Latency simulation ────────────────────────────────────
// Real Canton sandbox transactions take 200-500ms. Without
// this, mock-mode UX (instant green toasts) feels fake and
// inconsistent with the local sandbox path. These delays
// make the demo accurately reflect production timing.
const SUBMIT_LATENCY_MS = [250, 400]   // command submission
const READ_LATENCY_MS = [80, 120]      // contract queries

const randomDelay = ([min, max]) =>
  new Promise((resolve) =>
    setTimeout(resolve, min + Math.random() * (max - min))
  )

// Mock parties — fixed IDs for the demo
export const MOCK_PARTIES = {
  shipper: {
    party: 'Shipper::mock-1220abcdef1234567890',
    displayName: 'Murat Logistics',
  },
  carrier: {
    party: 'Carrier::mock-1220fedcba0987654321',
    displayName: 'FastFreight',
  },
}

// In-memory contract storage (hydrated from localStorage on load)
let activeContracts = initial.contracts

// ─── Helpers ───────────────────────────────────────────────

const nowIso = () => new Date().toISOString()

const findContract = (cid) =>
  activeContracts.find((c) => c.contractId === cid)

const archive = (cid) => {
  activeContracts = activeContracts.filter((c) => c.contractId !== cid)
  persist()
}

const create = (template, payload) => {
  const cid = generateCid()
  const contract = {
    contractId: cid,
    template,
    payload,
  }
  activeContracts.push(contract)
  persist()
  return cid
}

// Helper to dedupe AcceptClaim/RejectClaim — both create a new
// Invoice with identical structure, only amount/details differ.
const createSettlementInvoice = (dispute, amount, details) =>
  create('Invoice', {
    shipper: dispute.payload.shipper,
    carrier: dispute.payload.carrier,
    origin: dispute.payload.origin,
    destination: dispute.payload.destination,
    cargoType: dispute.payload.cargoType,
    weightKg: dispute.payload.weightKg,
    amount,
    details,
    isPaid: false,
    createdAt: nowIso(),
  })

// ─── Public API (matches ledger.js) ─────────────────────────

export const getMockParties = async () => {
  return [MOCK_PARTIES.shipper, MOCK_PARTIES.carrier]
}

export const getMockActiveContracts = async (party) => {
  await randomDelay(READ_LATENCY_MS)
  // In real Daml, selective disclosure filters by signatory/observer.
  // Here we return everything where the party is involved.
  return activeContracts.filter((c) => {
    const p = c.payload
    return p.shipper === party || p.carrier === party
  })
}

export const submitMockCommand = async (party, command) => {
  await randomDelay(SUBMIT_LATENCY_MS)
  const { templateId, choice, contractId, argument } = command
  const tpl = (templateId || '').split(':').pop() || ''

  // ── CREATE: ShipmentProposal ──
  if (choice === undefined && tpl === 'ShipmentProposal') {
    const cid = create('ShipmentProposal', {
      ...argument,
      shipper: party,
    })
    return { contractId: cid }
  }

  // ── EXERCISE: choices ──
  const c = findContract(contractId)
  if (!c) throw new Error(`Contract ${contractId} not found (already archived?)`)

  switch (choice) {
    case 'Accept': {
      if (party !== c.payload.carrier) {
        throw new Error('Only the carrier can accept this proposal')
      }
      // ShipmentProposal → Shipment
      archive(contractId)
      const newCid = create('Shipment', { ...c.payload })
      return { contractId: newCid }
    }

    case 'Reject': {
      if (party !== c.payload.carrier) {
        throw new Error('Only the carrier can reject this proposal')
      }
      archive(contractId)
      return {}
    }

    case 'CreateInvoice': {
      if (party !== c.payload.carrier) {
        throw new Error('Only the carrier can create invoices')
      }
      // Shipment → Invoice
      archive(contractId)
      const newCid = create('Invoice', {
        shipper: c.payload.shipper,
        carrier: c.payload.carrier,
        origin: c.payload.origin,
        destination: c.payload.destination,
        cargoType: c.payload.cargoType,
        weightKg: c.payload.weightKg,
        amount: c.payload.price,
        details: c.payload.details,
        isPaid: false,
        createdAt: c.payload.createdAt || nowIso(),
      })
      return { contractId: newCid }
    }

    case 'MarkPaid': {
      if (party !== c.payload.shipper) {
        throw new Error('Only the shipper can mark invoices as paid')
      }
      if (c.payload.isPaid) throw new Error('Invoice is already paid')
      archive(contractId)
      const newCid = create('Invoice', { ...c.payload, isPaid: true })
      return { contractId: newCid }
    }

    case 'RaiseDispute': {
      if (party !== c.payload.shipper) {
        throw new Error('Only the shipper can raise a dispute')
      }
      if (c.payload.isPaid) throw new Error('Cannot dispute a paid invoice')
      const claimed = parseFloat(argument.claimedAmount)
      if (claimed > parseFloat(c.payload.amount)) {
        throw new Error('Claim cannot exceed invoice amount')
      }
      if (claimed <= 0) {
        throw new Error('Claim must be positive')
      }
      archive(contractId)
      const newCid = create('Dispute', {
        shipper: c.payload.shipper,
        carrier: c.payload.carrier,
        origin: c.payload.origin,
        destination: c.payload.destination,
        cargoType: c.payload.cargoType,
        weightKg: c.payload.weightKg,
        originalAmount: c.payload.amount,
        claimedAmount: claimed.toString(),
        reason: argument.reason,
        status: { tag: 'Open', value: {} },
        createdAt: nowIso(),
      })
      return { contractId: newCid }
    }

    case 'AcceptClaim': {
      if (party !== c.payload.carrier) {
        throw new Error('Only the carrier can resolve disputes')
      }
      if (c.payload.status?.tag !== 'Open') throw new Error('Dispute already resolved')
      archive(contractId)
      const newCid = createSettlementInvoice(
        c,
        c.payload.claimedAmount,
        `Settlement after dispute: ${c.payload.reason}`,
      )
      return { contractId: newCid }
    }

    case 'RejectClaim': {
      if (party !== c.payload.carrier) {
        throw new Error('Only the carrier can resolve disputes')
      }
      if (c.payload.status?.tag !== 'Open') throw new Error('Dispute already resolved')
      archive(contractId)
      const newCid = createSettlementInvoice(
        c,
        c.payload.originalAmount,
        `Dispute rejected; original amount stands. Reason: ${c.payload.reason}`,
      )
      return { contractId: newCid }
    }

    default:
      throw new Error(`Unknown choice: ${choice}`)
  }
}

// Reset for demos (optional helper). Clears localStorage too.
export const resetMockLedger = () => {
  activeContracts = []
  contractIdCounter = 1
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const isMockMode = () =>
  import.meta.env.VITE_MOCK_MODE === 'true'