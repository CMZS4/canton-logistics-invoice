// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
// Aggregated metrics derived from active ledger contracts.
// Everything here is a function of the same contracts list
// used by the role panels — no separate data source.
// ═══════════════════════════════════════════════════════════

export default function Dashboard({ contracts }) {
  const proposals = contracts.filter(c => c.template === 'ShipmentProposal')
  const shipments = contracts.filter(c => c.template === 'Shipment')
  const invoices = contracts.filter(c => c.template === 'Invoice')

  const paidInvoices = invoices.filter(inv =>
    inv.fields.isPaid === true || inv.fields.isPaid === 'true'
  )
  const pendingInvoices = invoices.filter(inv =>
    !(inv.fields.isPaid === true || inv.fields.isPaid === 'true')
  )

  const totalShipments = proposals.length + shipments.length + invoices.length
  const settlementRate = invoices.length > 0
    ? Math.round((paidInvoices.length / invoices.length) * 100)
    : 0

  const totalSettledVolume = paidInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.fields.amount || 0),
    0
  )

  const totalPendingVolume = pendingInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.fields.amount || 0),
    0
  )

  // For the velocity bar
  const settled = paidInvoices.length
  const pending = pendingInvoices.length + proposals.length + shipments.length
  const total = settled + pending
  const settledPct = total > 0 ? (settled / total) * 100 : 0
  const pendingPct = total > 0 ? (pending / total) * 100 : 0

  return (
    <div className="panel">
      <h2>📊 Workflow Dashboard</h2>
      <p className="dash-sub">Real-time metrics from the Canton ledger.</p>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{totalShipments}</div>
          <div className="kpi-label">Active Contracts</div>
          <div className="kpi-hint">on ledger</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{paidInvoices.length}</div>
          <div className="kpi-label">Settled Invoices</div>
          <div className="kpi-hint">tamper-proof</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">${totalSettledVolume.toLocaleString('en-US')}</div>
          <div className="kpi-label">Volume Settled</div>
          <div className="kpi-hint">all-time</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{settlementRate}%</div>
          <div className="kpi-label">Settlement Rate</div>
          <div className="kpi-hint">paid / total</div>
        </div>
      </div>

      {/* Velocity bar */}
      <div className="velocity-section">
        <h3>Settlement Velocity</h3>
        <div className="velocity-bar">
          <div
            className="velocity-segment settled"
            style={{ width: `${settledPct}%` }}
          >
            {settled > 0 && <span>{settled} settled</span>}
          </div>
          <div
            className="velocity-segment pending"
            style={{ width: `${pendingPct}%` }}
          >
            {pending > 0 && <span>{pending} pending</span>}
          </div>
        </div>
        {total === 0 && (
          <p className="empty">No activity yet — create a proposal to begin.</p>
        )}
      </div>

      {/* Outstanding amount */}
      {totalPendingVolume > 0 && (
        <div className="outstanding-box">
          <div className="outstanding-label">Outstanding receivables</div>
          <div className="outstanding-value">
            ${totalPendingVolume.toLocaleString('en-US')}
          </div>
          <div className="outstanding-hint">
            across {pendingInvoices.length} unpaid invoice{pendingInvoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="activity-section">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {invoices.slice(0, 5).map(inv => {
            const paid = inv.fields.isPaid === true || inv.fields.isPaid === 'true'
            return (
              <div key={inv.contractId} className="activity-row">
                <span className="activity-icon">{paid ? '✅' : '⏳'}</span>
                <span className="activity-text">
                  {paid ? 'Settled' : 'Pending'}: ${parseFloat(inv.fields.amount).toLocaleString('en-US')} — {inv.fields.details}
                </span>
              </div>
            )
          })}
          {shipments.slice(0, 3).map(s => (
            <div key={s.contractId} className="activity-row">
              <span className="activity-icon">🚚</span>
              <span className="activity-text">
                In transit: {s.fields.details} — ${parseFloat(s.fields.price).toLocaleString('en-US')}
              </span>
            </div>
          ))}
          {proposals.slice(0, 3).map(p => (
            <div key={p.contractId} className="activity-row">
              <span className="activity-icon">📝</span>
              <span className="activity-text">
                Proposed: {p.fields.details} — ${parseFloat(p.fields.price).toLocaleString('en-US')}
              </span>
            </div>
          ))}
          {invoices.length === 0 && shipments.length === 0 && proposals.length === 0 && (
            <p className="empty">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}