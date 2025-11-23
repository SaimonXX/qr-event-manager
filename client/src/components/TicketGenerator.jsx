import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export default function TicketGenerator() {
  const { id } = useParams();
  const [tickets, setTickets] = useState([]);
  const [qty, setQty] = useState(10);
  const [event, setEvent] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);

  const loadData = async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        api.get(`/tickets/${id}`),
        api.get(`/events/${id}/public`)
      ]);
      setTickets(tRes.data);
      setEvent(eRes.data);
    } catch (e) { toast.error('Error loading data'); }
  };

  useEffect(() => { loadData(); }, [id]);

  const generate = async () => {
    if (!confirm(`Generate ${qty} new tickets?`)) return;
    try {
      await api.post('/tickets/generate', { event_id: id, quantity: Number(qty) });
      toast.success('Generated');
      loadData();
    } catch (e) { toast.error('Generation failed'); }
  };

  const deleteTicket = async (ticketId) => {
    if (!confirm('Permanently delete this ticket?')) return;
    try {
      await api.delete(`/tickets/single/${ticketId}`);
      toast.success('Ticket deleted');
      setTickets(tickets.filter(t => t.id !== ticketId));
      setSelectedTicket(null);
    } catch (e) { toast.error('Deletion failed'); }
  };

  return (
    <div className="container">
      <div className="no-print">
        <Link to="/" className="btn btn-secondary" style={{width:'auto', marginBottom:'1rem'}}>← Back</Link>
        <div className="card">
          <h1>{event.name}</h1>
          <p style={{color:'var(--text-secondary)'}}>Total Tickets: {tickets.length}</p>
          <div style={{display:'flex', gap:'10px', marginTop:'1rem', flexWrap:'wrap'}}>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{width:'80px', margin:0}} />
            <button className="btn" style={{width:'auto'}} onClick={generate}>Generate Batch</button>
            <button className="btn btn-outline" style={{width:'auto'}} onClick={() => {
               navigator.clipboard.writeText(`${window.location.origin}/claim/${id}`);
               toast.success('Claim Link Copied');
            }}>Copy Claim Link</button>
            <button className="btn btn-secondary" style={{width:'auto'}} onClick={() => window.print()}>Print PDF</button>
          </div>
        </div>
      </div>

      {selectedTicket && (
        <div className="scan-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="card" style={{background:'white', color:'black', maxWidth:'400px', width:'90%'}} onClick={e => e.stopPropagation()}>
            <h3>Ticket Details</h3>
            <div style={{textAlign:'left', margin:'1rem 0'}}>
              <p><strong>Status:</strong> {selectedTicket.status}</p>
              <p><strong>Guest:</strong> {selectedTicket.guest_name || '-'}</p>
              <p><strong>ID:</strong> {selectedTicket.guest_id_number || '-'}</p>
              <p><strong>Phone:</strong> {selectedTicket.guest_phone || '-'}</p>
            </div>
            <button className="btn btn-danger" onClick={() => deleteTicket(selectedTicket.id)}>Delete Ticket</button>
            <button className="btn btn-secondary" style={{marginTop:'0.5rem'}} onClick={() => setSelectedTicket(null)}>Close</button>
          </div>
        </div>
      )}

      <div className="qr-grid">
        {tickets.map(t => (
          <div key={t.id} className="qr-card" onClick={() => setSelectedTicket(t)} style={{border: t.guest_name ? '2px solid var(--accent)' : '1px solid #e2e8f0'}}>
            <QRCode value={t.id} size={100} style={{height:'auto', maxWidth:'100%', width:'100%'}} />
            <div style={{marginTop:'0.5rem'}}>
              <span className={`tag ${t.status}`}>{t.status}</span>
            </div>
            {t.guest_name ? (
               <div style={{marginTop:'0.25rem'}}>
                 <strong style={{display:'block', fontSize:'0.8rem', color:'var(--accent)'}}>{t.guest_name.split(' ')[0]}</strong>
                 <small style={{fontSize:'0.7rem', color:'#64748b'}}>{t.guest_id_number}</small>
               </div>
            ) : <small style={{color:'#94a3b8'}}>Available</small>}
          </div>
        ))}
      </div>
    </div>
  );
}