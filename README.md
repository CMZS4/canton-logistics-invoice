# ChainFreight

**Proof, not promises.** Tamper-proof shipment & invoice workflow on Canton Network.

> HackCanton League Season #1 — RWA & Business Workflows Track

---

## The Problem

SME freight forwarders lose **3–5 hours every week** resolving shipment and invoice disputes. The only proof lives in WhatsApp, Excel, and email — tools that can be edited, lost, or deleted.

When the operations manager can't prove the carrier's side, the forwarder absorbs the cost.

## The Solution

ChainFreight puts the shipment-to-invoice workflow on **Canton Network** as tamper-proof smart contracts with selective disclosure. Every shipment, acceptance, invoice, and payment becomes a verifiable, immutable ledger record. Each party sees only what they are allowed to see.

**What took 3 hours of manual reconciliation now settles in under 2 minutes.**

---

## The Workflow
Shipper creates proposal
↓
Carrier accepts → Shipment contract
↓
Carrier invoices → Invoice contract
↓
Shipper marks paid → isPaid: true

All four steps are real Canton transactions, each signed by the required parties.

---

## Architecture
┌─────────────────────────────────────────┐
│   React + Vite Frontend                 │
│   (Shipper / Carrier / Invoice panels)  │
└──────────────┬──────────────────────────┘
│ HTTP via Vite proxy
┌──────────────▼──────────────────────────┐
│   Canton JSON Ledger API (port 7575)    │
└──────────────┬──────────────────────────┘
│
┌──────────────▼──────────────────────────┐
│   Canton Sandbox + Daml contracts       │
│   ShipmentProposal · Shipment · Invoice │
└─────────────────────────────────────────┘

---

## Tech Stack

- **Daml 3.4.11** — smart contract language
- **Canton Network** — distributed ledger
- **React 19 + Vite** — frontend
- **JSON Ledger API** — ledger access over HTTP
- **Docker + Ubuntu WSL2** — dev environment

---

## Smart Contracts

Three Daml templates, all live on ledger:

### ShipmentProposal
- **Signatory:** Shipper
- **Observer:** Carrier
- **Choices:** `Accept`, `Reject`

### Shipment
- **Signatories:** Shipper + Carrier (both required)
- **Choice:** `CreateInvoice` (controller: Carrier)

### Invoice
- **Signatories:** Shipper + Carrier
- **Choice:** `MarkPaid` (controller: Shipper)
- Double-pay guarded via `assertMsg`

---

## Running Tests

Daml smart contracts ship with a happy-path test suite:

```bash
daml test
```

Expected output:
daml/Logistics.daml:testLogistics: ok, 1 active contracts, 4 transactions.

Tests cover the full workflow: `ShipmentProposal → Accept → Shipment → CreateInvoice → Invoice → MarkPaid`. The `assertMsg` guard against double-payment is exercised by the test scenario.

> Note: On Windows CMD, the Turkish locale can cause a `DAML-LF Name "SCRİPT"` parsing error. Run tests in WSL/Ubuntu or set `JAVA_TOOL_OPTIONS=-Duser.language=en` first.

---

## Running Locally

### Prerequisites

- Ubuntu (WSL2 on Windows works)
- Daml SDK 3.4.11 — `curl -sSL https://get.daml.com/ | sh`
- Node 20+

### Start the ledger

```bash
daml start
```

This compiles the DAR, starts the Canton sandbox on port 6865, and exposes the JSON API on port 7575.

### Create the parties (once)

```bash
curl -X POST http://localhost:7575/v2/parties \
  -H "Content-Type: application/json" \
  -d '{"partyIdHint":"Shipper","displayName":"Murat Logistics"}'

curl -X POST http://localhost:7575/v2/parties \
  -H "Content-Type: application/json" \
  -d '{"partyIdHint":"Carrier","displayName":"FastFreight"}'
```

Copy the returned `party` values into `frontend/src/App.jsx` (`SHIPPER` and `CARRIER` constants).

### Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — you should see "🟢 Connected to Canton ledger via JSON API" at the top.

---

## Demo

**Live demo:** _[deployed URL coming soon]_

**Walkthrough video** (46 seconds): [https://youtu.be/HT-yrPHfErk](https://youtu.be/HT-yrPHfErk)

What you'll see in the live demo:
- A role selector that pulls real party IDs from `/v2/parties`
- Each role only sees actions it is authorized to perform on the ledger
- Every click triggers a real Canton transaction with toast feedback
---

## Project Status

- [x] Daml smart contracts (3 templates, test suite passing)
- [x] Canton sandbox running locally
- [x] JSON API integration verified via `curl`
- [x] React frontend connected to live ledger
- [x] End-to-end workflow working (browser → API → ledger)
- [x] Dynamic role selector (party IDs fetched from ledger)
- [x] Toast notifications for every ledger action
- [x] Role-aware UI (each party only sees authorized actions)
- [x] Submission demo video
- [ ] Live web deployment (Vercel)
- [ ] Production deployment (Canton devnet)
- [ ] Pilot with real freight forwarder

---

## Target User

**Murat** — Operations manager at a mid-sized Turkish freight forwarder handling ~120 shipments/month across multiple carriers. Pain: absorbing dispute costs because there's no tamper-proof record of who agreed to what.

**Market:** ~2,700 SME freight forwarders in Turkey alone, part of an industry where manual reconciliation and documentation errors are a major cost center.

---

## What's Real, What's Next

**Live today:**
- Three Daml contract templates on Canton sandbox
- Full workflow executed end-to-end from the React UI
- Multi-party signatures + selective disclosure enforced by the ledger

**Next:**
- Deploy to Canton devnet (live network)
- Pilot with one real freight forwarder for production validation
- Additional workflows: proof-of-delivery, customs paperwork, dispute resolution

---

## Security & Trust Model

ChainFreight inherits Canton's multi-party authorization model end-to-end:

- **Signatories.** Every contract requires both Shipper and Carrier as signatories on `Shipment` and `Invoice`. Neither party can unilaterally create, modify, or settle a contract — both must authorize.
- **Selective disclosure.** A `ShipmentProposal` is signed by the Shipper and only observed by the named Carrier. Other parties on the ledger cannot see it.
- **Choice controllers.** Each state transition is gated by a specific party: only the Carrier can `Accept` a proposal, only the Shipper can `MarkPaid` an invoice.
- **Double-payment guard.** The `MarkPaid` choice carries an `assertMsg "Invoice is already paid" (not isPaid)` check enforced ledger-side. Replay attempts fail at the ledger, not the UI.
- **Tamper-proof history.** Every action — create, accept, invoice, pay — is an immutable Canton transaction. There is no "edit" path.

The frontend never holds private keys; all submissions go through the participant node via the JSON Ledger API, with `actAs` tying the request to a Canton party.

## Known Limitations

We list these explicitly because they matter for any production conversation:

- **Polling, not streaming.** The UI refreshes via `/v2/state/active-contracts` every 3 seconds. For production, Canton's gRPC streaming or PQS-backed subscriptions would replace polling.
- **`details: Text` payload.** Shipment details are intentionally a free-text field for the hackathon. A production schema would split origin, destination, INCO terms, weight, and cargo type into typed fields.
- **Single sandbox, single domain.** No devnet deployment yet. The same Daml package is deploy-ready for Canton devnet; the work is operational, not architectural.

## License

Apache 2.0