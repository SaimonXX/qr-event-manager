import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export default function Dashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ name: '', date: '', location: '' });
  const [editingId, setEditingId] = useState(null);

  const loadEvents = async () => {
    try {
      const { data } = await api.get(`/events?user_id=${user.id}`);
      setEvents(data);
    } catch (e) { toast.error('Failed to load events'); }
  };

  useEffect(() => { loadEvents(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      if (editingId) {
        await api.put(`/events/${editingId}`, form);
        toast.success('Event updated');
        setEditingId(null);
      } else {
        await api.post('/events', { ...form, user_id: user.id });
        toast.success('Event created');
      }
      setForm({ name: '', date: '', location: '' });
      loadEvents();
    } catch (e) { toast.error('Operation failed'); }
  };

  const startEdit = (ev) => {
    setEditingId(ev.id);
    setForm({ name: ev.name, date: ev.event_date ? ev.event_date.split('T')[0] : '', location: ev.location || '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete event and all tickets?')) return;
    try { await api.delete(`/events/${id}`); loadEvents(); toast.success('Deleted'); } 
    catch (e) { toast.error('Delete failed'); }
  };

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
        <div>
          <h1>Dashboard</h1>
          <span style={{color:'var(--text-secondary)'}}>{user.email}</span>
        </div>
        <Link to="/scanner" className="btn" style={{width:'auto', background:'#e11d48'}}>SCANNER APP</Link>
      </div>

      <div className="card">
        <h3>{editingId ? 'Edit Event' : 'New Event'}</h3>
        <form onSubmit={handleSubmit}>
          <input placeholder="Event Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            <input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            <button className="btn">{editingId ? 'Save Changes' : 'Create Event'}</button>
            {editingId && <button type="button" className="btn btn-secondary" onClick={() => {setEditingId(null); setForm({name:'', date:'', location:''})}}>Cancel</button>}
          </div>
        </form>
      </div>

      <div style={{display:'grid', gap:'1rem'}}>
        {events.map(ev => (
          <div key={ev.id} className="card" style={{margin:0, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap'}}>
            <div>
              <h3 style={{margin:0}}>{ev.name}</h3>
              <p style={{margin:'0.5rem 0', color:'var(--text-secondary)'}}>
                📅 {new Date(ev.event_date).toLocaleDateString()} &nbsp;|&nbsp; 📍 {ev.location}
              </p>
            </div>
            <div style={{display:'flex', gap:'0.5rem'}}>
              <Link to={`/event/${ev.id}`} className="btn btn-outline" style={{width:'auto'}}>Manage</Link>
              <button onClick={() => startEdit(ev)} className="btn btn-secondary" style={{width:'auto'}}>Edit</button>
              <button onClick={() => handleDelete(ev.id)} className="btn btn-danger" style={{width:'auto'}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}