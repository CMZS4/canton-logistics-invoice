# Canton Logistics Invoice System

A logistics invoice tracking system built on Canton Network for HackCanton Season 1.

## Overview

This project implements a real-world logistics workflow on Canton Network using Daml smart contracts. It addresses the problem of opaque, paper-based logistics and invoicing processes by providing a transparent, tamper-proof ledger.

## Track

**RWA & Business Workflows** — Real-world business process moved on-chain.

## Workflow

1. **Shipper** creates a shipment proposal with delivery details and price
2. **Carrier** accepts or rejects the proposal
3. On acceptance, a binding Shipment contract is created
4. After delivery, the **Carrier** creates an Invoice
5. The **Shipper** marks the invoice as paid

## Tech Stack

- **Daml 3.4.11** — Smart contracts
- **Canton Network** — Distributed ledger
- **DAML Studio** — AI-assisted contract generation

## Project Status

- [x] Core Daml contracts (ShipmentProposal, Shipment, Invoice)
- [x] Test scenario with full workflow
- [ ] Frontend UI
- [ ] Backend API integration
- [ ] Demo deployment

## Test Results

testLogistics: ok, 1 active contracts, 4 transactions.

All 4 workflow steps (propose → accept → invoice → pay) executed successfully.

## License

MIT