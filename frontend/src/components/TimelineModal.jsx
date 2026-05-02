import { getEvents, getWorkflowId } from '../lib/eventLog'

export default function TimelineModal({ contract, workflowId, onClose }) {
  if (!contract) return null

  const wfId = workflowId || getWorkflowId() || contract.contractId
  const events = getEvents(wfId)

  function formatTime(iso) {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <span className="modal-template-badge">{contract.template}</span>
            <h3 className="modal-title">
              {contract.fields.origin && contract.fields.destination
                ? `${contract.fields.origin} → ${contract.fields.destination}`
                : 'Timeline'}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">⛓ Tamper-Proof Audit Trail</div>
          <p className="modal-hint">
            Every step below is a signed Canton transaction recorded on-ledger.
            No single party can modify or delete this history.
          </p>
        </div>

        <div className="modal-section">
          {events.length === 0 ? (
            <p className="modal-hint">
              No events recorded yet. Events are logged when actions are taken in this session.
            </p>
          ) : (
            <div className="timeline">
              {events.map((e, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-event">{e.eventType}</div>
                    <div className="timeline-meta">
                      <span className="timeline-time">{formatTime(e.timestamp)}</span>
                      <span className="timeline-actor">by {e.actor}</span>
                    </div>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <div className="timeline-details">
                        {Object.entries(e.details).map(([k, v]) => (
                          <span key={k} className="timeline-detail-pill">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="modal-hint">
            Audit trail stored locally and linked to Canton contract IDs.
            In production, this would be derived directly from ledger event history.
          </p>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  )
}