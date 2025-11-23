import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export default function ClaimTicket() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({ name: '', dni: '', phone: '' });
  const [myTicket, setMyTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    let storedId = localStorage.getItem('device_id');
    if (!storedId) {
      storedId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
      localStorage.setItem('device_id', storedId);
    }
    setDeviceId(storedId);

    const savedTicket = localStorage.getItem(`ticket_${id}`);
    if (savedTicket) {
      try { setMyTicket(JSON.parse(savedTicket)); } catch (e) { localStorage.removeItem(`ticket_${id}`); }
    }
    
    api.get(`/events/${id}/public`).then(res => setEvent(res.data)).catch(() => toast.error('Event not found'));
  }, [id]);

  const handleClaim = async (e) => {
    e.preventDefault();
    if (!form.name || !form.dni || !form.phone) return toast.error('Fill all fields');
    setLoading(true);

    try {
      const { data } = await api.post('/tickets/claim', {
        event_id: id,
        guest_name: form.name,
        guest_id_number: form.dni,
        guest_phone: form.phone,
        device_id: deviceId 
      });

      setMyTicket(data.ticket);
      localStorage.setItem(`ticket_${id}`, JSON.stringify(data.ticket));
      toast.success(data.isRecovery ? 'Ticket Recovered' : 'Ticket Issued');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Claim failed');
    } finally {
      setLoading(false);
    }
  };

  if (!event) return <div className="container" style={{textAlign:'center'}}>Loading...</div>;

  return (
    <div className="container" style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
      <div className="card" style={{width:'100%', maxWidth:'400px', textAlign:'center', borderTop:'4px solid var(--accent)'}}>
        <h1>{event.name}</h1>
        <p style={{color:'var(--text-secondary)'}}>
          📅 {new Date(event.event_date).toLocaleDateString()} <br/> 📍 {event.location || 'TBA'}
        </p>
        {!myTicket && event.available_tickets > 0 && <span className="tag valid" style={{marginTop:'1rem'}}>{event.available_tickets} Available</span>}
        {!myTicket && event.available_tickets === 0 && <span className="tag used" style={{marginTop:'1rem'}}>SOLD OUT</span>}
      </div>

      {myTicket ? (
        <div className="card" style={{width:'100%', maxWidth:'400px', background:'white', color:'black', textAlign:'center'}}>
          <h2 style={{color:'var(--bg-primary)'}}>Access Pass</h2>
          <div style={{padding:'1rem', border:'4px solid black', display:'inline-block', borderRadius:'1rem', margin:'1rem 0'}}>
            <QRCode value={myTicket.id} size={200} style={{maxWidth:'100%', height:'auto'}} />
          </div>
          <div style={{textAlign:'left', background:'#f1f5f9', padding:'1rem', borderRadius:'0.5rem'}}>
            <p style={{margin:'0.25rem 0'}}><strong>Guest:</strong> {myTicket.guest_name}</p>
            <p style={{margin:'0.25rem 0'}}><strong>ID:</strong> {myTicket.guest_id_number}</p>
          </div>
          <div style={{margin:'1rem 0', fontSize:'0.8rem', background:'#fff7ed', padding:'0.5rem', color:'#c2410c', borderRadius:'0.25rem'}}>
             ⚠️ Present physical ID at entry.
          </div>
          <button className="btn" style={{background:'black'}} onClick={() => window.print()}>Save Ticket</button>
        </div>
      ) : (
        event.available_tickets > 0 && (
          <div className="card" style={{width:'100%', maxWidth:'400px'}}>
            <h3>Registration</h3>
            <form onSubmit={handleClaim}>
              <label>Full Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Doe" />
              <label>Government ID / DNI</label>
              <input value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} required placeholder="ID Number" />
              <label>Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="Mobile" />
              <button className="btn" disabled={loading}>{loading ? 'Processing...' : 'Get Ticket'}</button>
            </form>
          </div>
        )
      )}
    </div>
  );
}