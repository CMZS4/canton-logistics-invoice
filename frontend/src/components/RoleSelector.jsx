import { useState, useEffect } from 'react'
import { fetchParties } from '../lib/ledger'

// ═══════════════════════════════════════════════════════════
// ROLE SELECTOR (login screen)
// ═══════════════════════════════════════════════════════════
// Pulls actual party IDs from /v2/parties on mount and
// renders Shipper / Carrier role cards. The chosen party
// is bubbled up via onSelect.
// ═══════════════════════════════════════════════════════════

export default function RoleSelector({ onSelect }) {
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchParties()
      .then(list => {
        // filter out system party (starts with "sandbox::")
        const user = list.filter(p => !p.party.startsWith('sandbox::'))
        setParties(user)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const byHint = (hint) => parties.find(p => p.party.startsWith(hint + '::'))

  const shipper = byHint('Shipper')
  const carrier = byHint('Carrier')

  return (
    <div className="role-screen">
      <div className="role-box">
        <h1>⚓ ChainFreight</h1>
        <p className="role-sub">Select your role to continue</p>

        {loading && <p className="empty">Loading parties from ledger…</p>}
        {error && <div className="error-banner">Could not reach ledger: {error}</div>}

        {!loading && !error && (
          <>
            {(!shipper || !carrier) && (
              <div className="error-banner">
                Parties not found. Run the setup curl commands from README first.
              </div>
            )}

            <div className="role-cards">
              <button
                className="role-card"
                disabled={!shipper}
                onClick={() => shipper && onSelect({ role: 'shipper', partyId: shipper.party })}
              >
                <div className="role-icon">🏢</div>
                <div className="role-title">Shipper</div>
                <div className="role-company">Murat Logistics Inc.</div>
                <div className="role-id">
                  {shipper ? `ID: ${shipper.party.slice(0, 24)}…` : 'Not provisioned'}
                </div>
              </button>

              <button
                className="role-card"
                disabled={!carrier}
                onClick={() => carrier && onSelect({ role: 'carrier', partyId: carrier.party })}
              >
                <div className="role-icon">🚚</div>
                <div className="role-title">Carrier</div>
                <div className="role-company">FastFreight Ltd.</div>
                <div className="role-id">
                  {carrier ? `ID: ${carrier.party.slice(0, 24)}…` : 'Not provisioned'}
                </div>
              </button>
            </div>
          </>
        )}

        <div className="ledger-status" style={{ marginTop: '24px' }}>
          🟢 Connected to Canton ledger via JSON API
        </div>
      </div>
    </div>
  )
}