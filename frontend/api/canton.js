export default async function handler(req, res) {
  const LEDGER_URL = 'https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services'
  const token = (process.env.CANTON_ACCESS_TOKEN || '').trim()

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