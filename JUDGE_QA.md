# ChainFreight — Judge Q&A Reference

A pre-prepared Q&A reference covering architecture choices, ledger selection, mock mode rationale, and validation status.

This document anticipates the most likely questions a technical jury would ask during evaluation and provides honest, structured answers — including trade-offs we are aware of and chose to defer.

---
ChainFreight Q&A Cheat Sheet
1) Architecture choices: UI-ledger coupling
Q: Why is the UI so closely coupled to the ledger logic?
A: Because this is a 21-day solo hackathon build, and the priority was to ship a working end-to-end workflow with low integration risk. We documented the intended production architecture — UI → Domain → Adapter → Ledger — but intentionally kept the demo path direct and explicit.
If pressed: The coupling is acknowledged in the README as technical debt, not hidden. For the hackathon, explicit coupling was safer than premature abstraction.

2) Why no domain layer?
Q: Why didn’t you build a separate domain layer?
A: We could have, but it would have added indirection without improving the demo outcome. The core value here is the ledger-backed workflow itself, so we optimized for clarity, speed, and reduced failure points.
If pressed: In production, a domain layer would be the right next step; for the hackathon, the simplest honest architecture was the best trade-off.

3) Canton / Daml choice vs Ethereum
Q: Why Canton instead of Ethereum?
A: Ethereum is great for public verifiability, but ChainFreight needs private coordination between known counterparties. Canton gives us selective disclosure and multi-party authorization without exposing shipment and invoice details to a public chain.
If pressed: This is a business workflow, not a public token or open settlement use case.

4) Canton / Daml choice vs Postgres
Q: Why not just use Postgres?
A: Postgres works well when one company owns the workflow, but ChainFreight is about shared truth across companies that don’t fully trust each other. Canton gives us a tamper-evident shared state with native authorization and privacy.
If pressed: Postgres scales the operator; Canton scales the agreement.

5) Canton / Daml choice vs Hyperledger
Q: Why not Hyperledger?
A: Hyperledger can absolutely support consortium workflows, but Canton is a cleaner fit for private, multi-party contract state with selective disclosure. It reduces the amount of trust and visibility logic we have to build ourselves.
If pressed: We wanted a ledger model that matches the workflow semantics instead of bolting privacy on afterward.

6) Mock mode exists
Q: Why do you have mock mode? Is that a fake demo?
A: No — the mock mode is a semantic mirror of the real Daml workflow for static deployment and demo reliability. It reproduces the same state transitions, authorization rules, and contract lifecycle so the judge sees the same business logic even when the live Canton sandbox isn’t available in the browser.
If pressed: The real ledger path still exists and is documented; mock mode is only for the deployment surface, not a substitute for the actual model.

7) Mock mode semantic equivalence
Q: How do you know the mock mode is trustworthy?
A: We modeled the same controller rules, consuming-choice semantics, and validation constraints in the mock ledger. That means the demo behavior matches the ledger logic closely enough to be honest about the workflow without pretending the browser is talking directly to Canton.
If pressed: It’s a demo-layer equivalence, not cryptographic security — the real ledger remains the source of truth.

8) Devnet deployment status
Q: Is it deployed to devnet?
A: Not yet — devnet deployment is in progress with support from mrlp4_noders. We prioritized a stable demo path and honest workflow fidelity first, because a shaky deploy would create more risk than value this close to submission.
If pressed: The submission is already functional locally and via the mock static deployment; devnet is a bonus, not a dependency for the core story.

9) Proof of Delivery absence
Q: Why didn’t you add Proof of Delivery?
A: We evaluated it and decided it was a deliberate trade-off. The current proposal → accept → invoice → dispute → settle flow already proves the core coordination problem, and PoD would have added complexity and demo risk for limited judge value.
If pressed: If we had an extra week, PoD would be a strong next addition — but at this stage, stability and clarity matter more.

10) Multi-currency design
Q: Why is multi-currency a big deal?
A: Because it’s not just a UI label — currency has to propagate consistently through proposal, shipment, invoice, dispute, and settlement so the workflow remains internally coherent. In a freight context, that’s part of the business state, not a display detail.
If pressed: We treat currency as a state consistency problem, which is why it’s modeled end-to-end in the mock and Daml flow.

11) Currency choice
Q: Why USD / TRY / EUR specifically?
A: Those currencies reflect the actual operating context of Turkish freight forwarders and cross-border SME logistics. We wanted the demo to feel operationally realistic, not generic.
If pressed: TRY matters for local operations, USD/EUR matter for international freight contracts.

12) Customer validation status
Q: What validation do you actually have?
A: We have secondary market research, two direct conversations with Istanbul SME freight forwarders, and multiple rounds of external reviewer feedback confirming the same pain points: manual reconciliation, dispute handling, and trust gaps between parties.
If pressed: We have not yet completed formal interviews or a live pilot; that’s the next validation step.

13) What’s planned for validation?
Q: What validation is still missing?
A: We still need structured interviews, a landing page / outreach test, and ideally a small pilot commitment from an operations manager. The current success target is at least three ops managers willing to try a free 30-day pilot after a walkthrough.
If pressed: We’re honest that the current evidence is strong for a hackathon, but not yet production-market proof.

14) Why this problem?
Q: Why build this at all?
A: Freight reconciliation is expensive, repetitive, and error-prone, especially when shipment events, invoices, and disputes are spread across email, WhatsApp, and spreadsheets. ChainFreight turns that into a shared, tamper-evident workflow.
If pressed: The pain is real because every dispute costs time, money, and relationship capital.

15) What’s the hard technical part?
Q: What was the hardest technical problem?
A: Daml authorization and contract lifecycle modeling were the hardest parts — especially the proposal/acceptance pattern needed to handle multi-party signatories correctly. Once that was solved, the rest of the workflow could be built around it.
If pressed: The key insight was that some contracts can’t be created unilaterally, so the workflow had to reflect that.

16) What if judges ask “why not just use a normal app?”
Q: Why does this need a ledger at all?
A: Because the core problem is shared truth between organizations that don’t fully trust each other. A normal app can store data, but it doesn’t give each party cryptographically authorized control over what they can see or change.
If pressed: This is about coordination and auditability, not just storage.

17) Biggest limitation
Q: What’s the biggest limitation of the current version?
A: The main limitation is that the production architecture is intentionally simplified for the hackathon, and devnet deployment is still in progress. We chose clarity and stability over a larger, riskier system design.
If pressed: The trade-off is explicit in the README.

18) What are you proudest of?
Q: What’s the strongest part of the submission?
A: The strongest part is that the workflow is real end-to-end: proposal, acceptance, invoice, dispute, settlement, and contract-level visibility are all modeled as state transitions, not just UI screens.
If pressed: It’s a working coordination system, not a mockup of one.