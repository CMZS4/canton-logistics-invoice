import { useState, useEffect } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
// Aggregated metrics derived from active ledger contracts.
// Now includes the dispute lifecycle.
// ═══════════════════════════════════════════════════════════

export default function Dashboard({ contracts }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const proposals = contracts.filter(c => c.template === 'ShipmentProposal')
  const shipments = contracts.filter(c => c.template === 'Shipment')
  const invoices = contracts.filter(c => c.template === 'Invoice')
  const disputes = contracts.filter(c => c.template === 'Dispute')

  const paidInvoices = invoices.filter(inv =>
    inv.fields.isPaid === true || inv.fields.isPaid === 'true'
  )
  const pendingInvoices = invoices.filter(inv =>
    !(inv.fields.isPaid === true || inv.fields.isPaid === 'true')
  )

  const totalContracts =
    proposals.length + shipments.length + invoices.length + disputes.length

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

  const totalDisputedVolume = disputes.reduce((sum, d) => {
    const orig = parseFloat(d.fields.originalAmount || 0)
    const claim = parseFloat(d.fields.claimedAmount || 0)
    return sum + (orig - claim)
  }, 0)

  // Pie chart data — workflow stage distribution
  const stageData = [
    { name: 'Proposed', value: proposals.length, color: '#3b82f6' },
    { name: 'In Transit', value: shipments.length, color: '#8b5cf6' },
    { name: 'Pending Pay', value: pendingInvoices.length, color: '#f59e0b' },
    { name: 'Disputed', value: disputes.length, color: '#ef4444' },
    { name: 'Settled', value: paidInvoices.length, color: '#10b981' }
  ].filter(d => d.value > 0)

  // For the velocity bar
  const settled = paidInvoices.length
  const inFlight = pendingInvoices.length + proposals.length + shipments.length
  const inDispute = disputes.length
  const total = settled + inFlight + inDispute
  const settledPct = total > 0 ? (settled / total) * 100 : 0
  const inFlightPct = total > 0 ? (inFlight / total) * 100 : 0
  const disputePct = total > 0 ? (inDispute / total) * 100 : 0

  // Activity feed
  const activity = [
    ...disputes.map(d => ({
      key: d.contractId,
      icon: '⚠️',
      type: 'dispute',
      text: `Dispute open: "${d.fields.reason}" — ${d.fields.origin} → ${d.fields.destination} (claim $${parseFloat(d.fields.claimedAmount).toLocaleString('en-US')} of $${parseFloat(d.fields.originalAmount).toLocaleString('en-US')})`
    })),
    ...paidInvoices.map(inv => ({
      key: inv.contractId,
      icon: '✅',
      type: 'settled',
      text: `Settled $${parseFloat(inv.fields.amount).toLocaleString('en-US')} — ${inv.fields.origin} → ${inv.fields.destination}`
    })),
    ...pendingInvoices.map(inv => ({
      key: inv.contractId,
      icon: '⏳',
      type: 'pending',
      text: `Awaiting payment $${parseFloat(inv.fields.amount).toLocaleString('en-US')} — ${inv.fields.origin} → ${inv.fields.destination}`
    })),
    ...shipments.map(s => ({
      key: s.contractId,
      icon: '🚚',
      type: 'transit',
      text: `In transit — ${s.fields.origin} → ${s.fields.destination} ($${parseFloat(s.fields.price).toLocaleString('en-US')})`
    })),
    ...proposals.map(p => ({
      key: p.contractId,
      icon: '📝',
      type: 'proposed',
      text: `Proposed — ${p.fields.origin} → ${p.fields.destination} ($${parseFloat(p.fields.price).toLocaleString('en-US')})`
    }))
  ].slice(0, 8)

  return (
    <div className="panel">
      <div className="dash-header">
        <div>
          <h2>📊 Workflow Dashboard</h2>
          <p className="dash-sub">Real-time metrics from the Canton ledger.</p>
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          LIVE · {now.toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{totalContracts}</div>
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
        <div className={`kpi-card ${disputes.length > 0 ? 'kpi-alert' : ''}`}>
          <div className="kpi-value">{disputes.length}</div>
          <div className="kpi-label">Open Disputes</div>
          <div className="kpi-hint">
            {disputes.length > 0
              ? `$${totalDisputedVolume.toLocaleString('en-US')} contested`
              : 'no active claims'}
          </div>
        </div>
      </div>

      {/* Two-column: chart + velocity */}
      <div className="dash-row">
        <div className="dash-cell">
          <h3>Workflow Stages</h3>
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty" style={{ paddingTop: '60px' }}>
              No contracts yet — create one to see the chart populate.
            </p>
          )}
          <div className="legend">
            {stageData.map(d => (
              <div key={d.name} className="legend-item">
                <span className="legend-dot" style={{ background: d.color }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        <div className="dash-cell">
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
              style={{ width: `${inFlightPct}%` }}
            >
              {inFlight > 0 && <span>{inFlight} in-flight</span>}
            </div>
            <div
              className="velocity-segment disputed"
              style={{ width: `${disputePct}%` }}
            >
              {inDispute > 0 && <span>{inDispute} disputed</span>}
            </div>
          </div>
          {total === 0 && (
            <p className="empty">No activity yet.</p>
          )}

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
        </div>
      </div>

      {/* Activity feed */}
      <div className="activity-section">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {activity.length === 0 ? (
            <p className="empty">No activity yet.</p>
          ) : (
            activity.map(a => (
              <div key={a.key} className={`activity-row activity-${a.type}`}>
                <span className="activity-icon">{a.icon}</span>
                <span className="activity-text">{a.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}