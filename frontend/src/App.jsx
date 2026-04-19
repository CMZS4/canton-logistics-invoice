import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('shipper')
  const [proposals, setProposals] = useState([])
  const [shipments, setShipments] = useState([])
  const [invoices, setInvoices] = useState([])

  // Shipper yeni proposal oluşturur
  const createProposal = (details, price) => {
    const newProposal = {
      id: Date.now(),
      shipper: 'Murat Lojistik A.Ş.',
      carrier: 'Hızlı Taşımacılık Ltd.',
      details,
      price,
      status: 'pending'
    }
    setProposals([...proposals, newProposal])
  }

  // Carrier proposal'ı kabul eder → Shipment olur
  const acceptProposal = (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId)
    const newShipment = { ...proposal, id: Date.now(), status: 'accepted' }
    setShipments([...shipments, newShipment])
    setProposals(proposals.filter(p => p.id !== proposalId))
  }

  // Carrier invoice oluşturur
  const createInvoice = (shipmentId) => {
    const shipment = shipments.find(s => s.id === shipmentId)
    const newInvoice = {
      id: Date.now(),
      shipper: shipment.shipper,
      carrier: shipment.carrier,
      details: shipment.details,
      amount: shipment.price,
      isPaid: false
    }
    setInvoices([...invoices, newInvoice])
    setShipments(shipments.filter(s => s.id !== shipmentId))
  }

  // Shipper invoice'u öder
  const markPaid = (invoiceId) => {
    setInvoices(invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, isPaid: true } : inv
    ))
  }

  return (
    <div className="app">
      <header>
        <h1>⚓ Canton Logistics</h1>
        <p>Tamper-proof shipment & invoice workflow on Canton Network</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'shipper' ? 'active' : ''}
          onClick={() => setActiveTab('shipper')}
        >
          🏢 Shipper Dashboard
        </button>
        <button
          className={activeTab === 'carrier' ? 'active' : ''}
          onClick={() => setActiveTab('carrier')}
        >
          🚚 Carrier Dashboard
        </button>
        <button
          className={activeTab === 'invoice' ? 'active' : ''}
          onClick={() => setActiveTab('invoice')}
        >
          💰 Invoices
        </button>
      </nav>

      <main>
        {activeTab === 'shipper' && (
          <ShipperPanel proposals={proposals} createProposal={createProposal} />
        )}
        {activeTab === 'carrier' && (
          <CarrierPanel
            proposals={proposals}
            shipments={shipments}
            acceptProposal={acceptProposal}
            createInvoice={createInvoice}
          />
        )}
        {activeTab === 'invoice' && (
          <InvoicePanel invoices={invoices} markPaid={markPaid} />
        )}
      </main>
    </div>
  )
}

// SHIPPER PANELİ
function ShipperPanel({ proposals, createProposal }) {
  const [details, setDetails] = useState('')
  const [price, setPrice] = useState('')

  const handleSubmit = () => {
    if (!details || !price) return
    createProposal(details, parseFloat(price))
    setDetails('')
    setPrice('')
  }

  return (
    <div className="panel">
      <h2>Yeni Sevkiyat Önerisi Oluştur</h2>
      <div className="form">
        <input
          type="text"
          placeholder="Sevkiyat detayı (örn: 20ft Konteyner - İstanbul → Ankara)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <input
          type="number"
          placeholder="Fiyat (TL)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button onClick={handleSubmit}>Öneri Gönder</button>
      </div>

      <h3>Bekleyen Önerilerim ({proposals.length})</h3>
      <div className="list">
        {proposals.length === 0 && <p className="empty">Henüz öneri yok.</p>}
        {proposals.map(p => (
          <div key={p.id} className="card pending">
            <div className="card-header">
              <strong>{p.details}</strong>
              <span className="badge">⏳ Bekliyor</span>
            </div>
            <p>Taşıyıcı: {p.carrier}</p>
            <p>Fiyat: {p.price.toLocaleString('tr-TR')} TL</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// CARRIER PANELİ
function CarrierPanel({ proposals, shipments, acceptProposal, createInvoice }) {
  return (
    <div className="panel">
      <h2>Gelen Öneriler ({proposals.length})</h2>
      <div className="list">
        {proposals.length === 0 && <p className="empty">Bekleyen öneri yok.</p>}
        {proposals.map(p => (
          <div key={p.id} className="card pending">
            <div className="card-header">
              <strong>{p.details}</strong>
              <span className="badge">⏳ Yeni</span>
            </div>
            <p>Gönderici: {p.shipper}</p>
            <p>Fiyat: {p.price.toLocaleString('tr-TR')} TL</p>
            <button onClick={() => acceptProposal(p.id)}>✅ Kabul Et</button>
          </div>
        ))}
      </div>

      <h2>Aktif Sevkiyatlar ({shipments.length})</h2>
      <div className="list">
        {shipments.length === 0 && <p className="empty">Aktif sevkiyat yok.</p>}
        {shipments.map(s => (
          <div key={s.id} className="card active">
            <div className="card-header">
              <strong>{s.details}</strong>
              <span className="badge success">✅ Kabul Edildi</span>
            </div>
            <p>Gönderici: {s.shipper}</p>
            <p>Tutar: {s.price.toLocaleString('tr-TR')} TL</p>
            <button onClick={() => createInvoice(s.id)}>📄 Fatura Oluştur</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// INVOICE PANELİ
function InvoicePanel({ invoices, markPaid }) {
  return (
    <div className="panel">
      <h2>Faturalar ({invoices.length})</h2>
      <div className="list">
        {invoices.length === 0 && <p className="empty">Henüz fatura yok.</p>}
        {invoices.map(inv => (
          <div key={inv.id} className={`card ${inv.isPaid ? 'paid' : 'unpaid'}`}>
            <div className="card-header">
              <strong>{inv.details}</strong>
              <span className={`badge ${inv.isPaid ? 'success' : 'warning'}`}>
                {inv.isPaid ? '✅ Ödendi' : '⏳ Beklemede'}
              </span>
            </div>
            <p>Gönderici: {inv.shipper}</p>
            <p>Taşıyıcı: {inv.carrier}</p>
            <p className="amount">{inv.amount.toLocaleString('tr-TR')} TL</p>
            {!inv.isPaid && (
              <button onClick={() => markPaid(inv.id)}>💳 Ödeme Yap</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App