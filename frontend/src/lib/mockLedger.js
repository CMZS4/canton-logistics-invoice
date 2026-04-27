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

let contractIdCounter = 1
const generateCid = () => `mock-cid-${contractIdCounter++}`

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

// In-memory contract storage
let activeContracts = []

// ─── Helpers ───────────────────────────────────────────────

const nowIso = () => new Date().toISOString()

const findContract = (cid) =>
  activeContracts.find((c) => c.contractId === cid)

const archive = (cid) => {
  activeContracts = activeContracts.filter((c) => c.contractId !== cid)
}

const create = (template, payload) => {
  const cid = generateCid()
  const contract = {
    contractId: cid,
    template,
    payload,
  }
  activeContracts.push(contract)
  return cid
}

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
      // ShipmentProposal → Shipment
      archive(contractId)
      const newCid = create('Shipment', { ...c.payload })
      return { contractId: newCid }
    }

    case 'Reject': {
      archive(contractId)
      return {}
    }

    case 'CreateInvoice': {
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
      if (c.payload.isPaid) throw new Error('Invoice is already paid')
      archive(contractId)
      const newCid = create('Invoice', { ...c.payload, isPaid: true })
      return { contractId: newCid }
    }

    case 'RaiseDispute': {
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
      if (c.payload.status?.tag !== 'Open') throw new Error('Dispute already resolved')
      archive(contractId)
      const newCid = create('Invoice', {
        shipper: c.payload.shipper,
        carrier: c.payload.carrier,
        origin: c.payload.origin,
        destination: c.payload.destination,
        cargoType: c.payload.cargoType,
        weightKg: c.payload.weightKg,
        amount: c.payload.claimedAmount,
        details: `Settlement after dispute: ${c.payload.reason}`,
        isPaid: false,
        createdAt: nowIso(),
      })
      return { contractId: newCid }
    }

    case 'RejectClaim': {
      if (c.payload.status?.tag !== 'Open') throw new Error('Dispute already resolved')
      archive(contractId)
      const newCid = create('Invoice', {
        shipper: c.payload.shipper,
        carrier: c.payload.carrier,
        origin: c.payload.origin,
        destination: c.payload.destination,
        cargoType: c.payload.cargoType,
        weightKg: c.payload.weightKg,
        amount: c.payload.originalAmount,
        details: c.payload.reason,
        isPaid: false,
        createdAt: nowIso(),
      })
      return { contractId: newCid }
    }

    default:
      throw new Error(`Unknown choice: ${choice}`)
  }
}

// Reset for demos (optional helper)
export const resetMockLedger = () => {
  activeContracts = []
  contractIdCounter = 1
}

export const isMockMode = () =>
  import.meta.env.VITE_MOCK_MODE === 'true'