export default async function handler(req, res) {
  const LEDGER_URL = 'https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services'
  const token = process.env.CANTON_ACCESS_TOKEN

  const path = req.url.replace('/api/canton', '') || '/'
  
  try {
    const response = await fetch(`${LEDGER_URL}${path}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}