let cachedToken = null
let tokenExpiry = 0

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken
  }
  const res = await fetch(
    'https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'web-app-ui-hackcanton-01-devnet',
        refresh_token: process.env.CANTON_REFRESH_TOKEN || '',
      }),
    }
  )
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000)
  return cachedToken
}

export default async function handler(req, res) {
  const LEDGER_URL = 'https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services'
  const token = await getAccessToken()

  const url = req.url || '/'
  const path = url.replace(/^\/api\/canton/, '') || '/'

  let bodyText = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof req.body === 'string') {
      bodyText = req.body
    } else if (req.body) {
      bodyText = JSON.stringify(req.body)
    }
  }

  try {
    const response = await fetch(`${LEDGER_URL}${path}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: bodyText,
    })

    const text = await response.text()
    try {
      const data = JSON.parse(text)
      res.status(response.status).json(data)
    } catch {
      res.status(response.status).send(text)
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}