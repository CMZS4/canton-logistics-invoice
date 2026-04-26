# ChainFreight

**Proof, not promises.** Tamper-proof shipment & invoice workflow on Canton Network.

> HackCanton League Season #1 — RWA & Business Workflows Track

## Why a ledger, not a database?

Two parties — a shipper and a carrier — need to agree on what was shipped, what was invoiced, what was paid, and what's in dispute. Today they reconcile this across WhatsApp, Excel, and email, and lose 3–5 hours a week on it. A traditional database doesn't solve that, because *whose* database is it? Whoever owns the database can edit the record.

ChainFreight runs the workflow as Daml smart contracts on Canton, where:

- **Both parties co-sign every transition.** A shipper cannot mark their own invoice paid for the carrier; a carrier cannot unilaterally settle a dispute.
- **Selective disclosure is enforced by the ledger.** Each role only sees the contracts they're authorized to see — not by hiding things in the UI, but by signatory and observer rules in the Daml code.
- **The state machine cannot be bypassed.** `assertMsg` checks (no double-pay, no dispute on a paid invoice, no claim above the invoice amount) live on the ledger, so the UI is just a thin client over a tamper-proof workflow.

This is what a ledger gives you that a database cannot.

[![Daml Tests](https://img.shields.io/badge/daml%20tests-4%20passing-success?style=flat-square)]()
[![Choice Coverage](https://img.shields.io/badge/choice%20coverage-63%25-yellow?style=flat-square)]()
[![Templates](https://img.shields.io/badge/templates-4-blue?style=flat-square)]()
[![Canton](https://img.shields.io/badge/canton-3.4.11-purple?style=flat-square)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)]()

---

## The Problem

SME freight forwarders lose **3–5 hours every week** resolving shipment and invoice disputes. The only proof lives in WhatsApp, Excel, and email — tools that can be edited, lost, or deleted.

When the operations manager can't prove the carrier's side, the forwarder absorbs the cost.

## The Solution

ChainFreight puts the shipment-to-invoice workflow on **Canton Network** as tamper-proof smart contracts with selective disclosure. Every shipment, acceptance, invoice, and payment becomes a verifiable, immutable ledger record. Each party sees only what they are allowed to see.

**What took 3 hours of manual reconciliation now settles in under 2 minutes.**

---

## The Workflow

The happy path:
Shipper creates proposal
↓
Carrier accepts → Shipment contract (or rejects, archived)
↓
Carrier issues Invoice
↓
Shipper marks paid → isPaid: true

The dispute path (when something goes wrong):
…Invoice exists
↓
Shipper raises Dispute (reason + claimed amount)
↓
Carrier resolves:
├─ AcceptClaim → reduced Invoice
└─ RejectClaim → original Invoice reissued
↓
Shipper pays the resolved Invoice

Every transition is a real Canton transaction signed by the required parties. The on-ledger state machine — not the UI — decides what is allowed.

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

## Screenshots

### Sign in as Shipper or Carrier
Each role gets a separate session, with its own party ID issued by the Canton ledger.

![Login](docs/screenshots/01-login.png.jpeg)

### Real-time analytics from the ledger
KPI cards, workflow stage donut, settlement velocity, and an activity feed — all derived from active contracts.

![Dashboard](docs/screenshots/02-dashboard.png.jpeg)

### Carrier reviews incoming proposals — Accept or Reject
Both choices are live on the ledger: Accept creates a Shipment, Reject archives the proposal.

![Carrier proposal](docs/screenshots/03-carrier-proposal.png.jpeg)

### Carrier issues an invoice
Once a shipment is in transit, the carrier can issue an invoice — both shipper and carrier co-sign it on the ledger.

![Carrier active](docs/screenshots/04-carrier-active.png.jpeg)

### Shipper raises a dispute
If something went wrong, the shipper raises a dispute with a reason and a claimed amount — capped at the original invoice on-ledger.

![Raise dispute](docs/05-raise-dispute.png.jpeg)

### Carrier resolves the dispute
The carrier accepts the claim (reduced invoice issued) or rejects it (original amount stands). Either path is enforced as a Daml choice.

![Resolve dispute](docs/screenshots/06-resolve-dispute.png.jpeg)

## Quick Start

You'll need [Daml SDK 3.4.11](https://docs.daml.com/getting-started/installation.html), Java 17, and Node.js 20+.

```bash
# 1. Clone and enter the repo
git clone https://github.com/CMZS4/canton-logistics-invoice.git
cd canton-logistics-invoice

# 2. Start the Canton sandbox + JSON Ledger API (keep this running)
daml start

# 3. In a second terminal, allocate the two parties
curl -X POST http://localhost:7575/v2/parties \
  -H "Content-Type: application/json" \
  -d '{"partyIdHint":"Shipper","displayName":"Murat Logistics"}'

curl -X POST http://localhost:7575/v2/parties \
  -H "Content-Type: application/json" \
  -d '{"partyIdHint":"Carrier","displayName":"FastFreight"}'

# 4. In a third terminal, start the React frontend
cd frontend
npm install
npm run dev

# 5. Open http://localhost:5173 — pick a role and go
```

To run the Daml test suite:

```bash
daml test
```

You should see all five scenarios pass: `testLogistics`, `testReject`, `testDisputeAccepted`, `testDisputeRejected`, `testEdgeCases`.

## Smart Contracts
         

Four Daml templates, all live on ledger.

### ShipmentProposal
- **Signatory:** Shipper
- **Observer:** Carrier
- **Choices:** `Accept` (creates Shipment), `Reject` (auto-archives)
- **Validation:** `ensure price > 0.0 && weightKg > 0.0`

### Shipment
- **Signatories:** Shipper + Carrier (both required)
- **Choice:** `CreateInvoice` (controller: Carrier)

### Invoice
- **Signatories:** Shipper + Carrier
- **Choices:**
  - `MarkPaid` (controller: Shipper) — guarded against double-pay
  - `RaiseDispute` (controller: Shipper) — see Dispute below
- **Validation:** `ensure amount > 0.0`

### Dispute
- **Signatories:** Shipper + Carrier
- **Status:** typed enum (`Open` | `Resolved`)
- **Choices:**
  - `AcceptClaim` (controller: Carrier) — issues a new Invoice with the claimed amount
  - `RejectClaim` (controller: Carrier) — reissues the original Invoice

The Dispute template is the difference between a happy-path demo and a real B2B workflow. Forwarders don't lose 3-5 hours a week on shipments that go right — they lose them on shipments that go wrong, and on having no shared, tamper-proof record of what was agreed.

### Type-safety details

- `DisputeStatus` is a Daml ADT, not a free-form string. Typos are rejected at compile time.
- `claimedAmount <= amount` is enforced inside `RaiseDispute`, not in the UI.
- All `assertMsg` checks (double-pay, dispute on already-paid invoice, status-already-resolved) run on the ledger — the UI cannot bypass them.

### A note on contract lifecycle

A common question: "do these contracts get archived after they're resolved?"

Yes — automatically. In Daml, choices are **consuming by default**, which means the contract on which a choice is exercised is archived as part of the same transaction. So:

- `Accept` archives the `ShipmentProposal` and creates a `Shipment`.
- `Reject` archives the `ShipmentProposal` with no replacement.
- `CreateInvoice` archives the `Shipment` and creates an `Invoice`.
- `MarkPaid` archives the unpaid `Invoice` and creates a paid one.
- `RaiseDispute` archives the `Invoice` and creates a `Dispute`.
- `AcceptClaim` / `RejectClaim` archives the `Dispute` and creates a fresh `Invoice` (reduced or original).

You can verify this from `daml test` output: `testReject` ends with `0 active contracts, 2 transactions` — the proposal was created and archived, leaving nothing behind. Adding an explicit `archive self` would actually be a bug; Daml would reject it as a double-archive in the same transaction.

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

- [x] Daml smart contracts — 4 templates, 4 test scenarios, 63% choice coverage
- [x] Canton sandbox running locally
- [x] JSON API integration verified via `curl`
- [x] React frontend connected to live ledger
- [x] End-to-end workflow working (browser → API → ledger)
- [x] Dynamic role selector (party IDs fetched from ledger)
- [x] Toast notifications for every ledger action
- [x] Role-aware UI (each party only sees authorized actions)
- [x] Reject flow (proposal archived on reject)
- [x] Dispute workflow (raise → accept/reject → settlement)
- [x] Real-time analytics dashboard (KPIs, donut chart, activity feed)
- [x] Structured shipment data (origin, destination, cargoType, weightKg)
- [x] Type-safe dispute status (Daml ADT, not string)
- [x] Submission demo video (older version — to be re-recorded)
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
- Four Daml contract templates on Canton sandbox
- Happy path: propose → accept → invoice → pay
- Dispute path: raise → accept claim (reduced invoice) | reject claim (original reissued) → pay
- Multi-party signatures + selective disclosure enforced by the ledger
- Real-time analytics dashboard derived from active contracts

**Next:**
- Deploy to Canton devnet (live network)
- Pilot with one real freight forwarder for production validation
- Additional workflows: proof-of-delivery, customs paperwork, document attachment
- Optional auditor party for selective disclosure of disputes to a neutral third party

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