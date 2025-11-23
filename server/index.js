import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { supabase } from './src/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.set('trust proxy', true);

app.get('/health', (req, res) => res.status(200).json({ status: 'OK', uptime: process.uptime() }));

// --- EVENTOS ---

app.post('/api/events', async (req, res) => {
  try {
    const { name, date, location, user_id } = req.body;
    if (!name || !user_id) return res.status(400).json({ error: 'Missing required fields' });

    const { data, error } = await supabase
      .from('events')
      .insert([{ name, event_date: date, location, user_id }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { user_id } = req.query;
    let query = supabase.from('events').select('*').order('created_at', { ascending: false });
    
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:id/public', async (req, res) => {
  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .single();
      
    if (eventError) throw eventError;

    const { count, error: countError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', req.params.id)
      .eq('status', 'valid')
      .is('guest_name', null);

    if (countError) throw countError;

    res.json({ ...event, available_tickets: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { name, date, location } = req.body;
    const { error } = await supabase
      .from('events')
      .update({ name, event_date: date, location })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { error: ticketError } = await supabase.from('tickets').delete().eq('event_id', req.params.id);
    if (ticketError) throw ticketError;

    const { error: eventError } = await supabase.from('events').delete().eq('id', req.params.id);
    if (eventError) throw eventError;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TICKETS ---

app.post('/api/tickets/generate', async (req, res) => {
  try {
    const { event_id, quantity } = req.body;
    if (!event_id || !quantity) return res.status(400).json({ error: 'Invalid parameters' });

    const tickets = Array.from({ length: Number(quantity) }).map(() => ({ event_id, status: 'valid' }));
    const { data, error } = await supabase.from('tickets').insert(tickets).select();

    if (error) throw error;
    res.status(201).json({ count: data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tickets/:eventId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', req.params.eventId)
      .order('guest_name', { ascending: true, nullsFirst: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tickets/single/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tickets').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tickets/claim', async (req, res) => {
  try {
    const { event_id, guest_name, guest_id_number, guest_phone, device_id } = req.body;
    
    if (!event_id || !guest_name || !guest_id_number || !device_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: existing } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', event_id)
      .or(`device_id.eq.${device_id},guest_id_number.eq.${guest_id_number}`)
      .limit(1)
      .single();

    if (existing) {
      if (existing.guest_id_number && existing.guest_id_number !== guest_id_number) {
         return res.status(403).json({ error: 'Device already used for another ID' });
      }
      return res.json({ success: true, ticket: existing, isRecovery: true });
    }

    const { data: freeTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('event_id', event_id)
      .eq('status', 'valid')
      .is('guest_name', null)
      .limit(1)
      .single();

    if (!freeTicket) return res.status(404).json({ error: 'Sold Out' });

    const { data: updated, error: upError } = await supabase
      .from('tickets')
      .update({ guest_name, guest_id_number, guest_phone, device_id })
      .eq('id', freeTicket.id)
      .select()
      .single();

    if (upError) throw upError;
    res.json({ success: true, ticket: updated });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SCANNER & VALIDATION ---

app.post('/api/tickets/check', async (req, res) => {
  try {
    const { qr_id } = req.body;
    if (!qr_id) return res.status(400).json({ error: 'Missing QR ID' });

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, events(name)')
      .eq('id', qr_id)
      .single();

    if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket, event: ticket.events?.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    const { qr_id } = req.body;
    if (!qr_id) return res.status(400).json({ error: 'Missing QR ID' });

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, events(name)')
      .eq('id', qr_id)
      .single();

    if (error || !ticket) return res.status(404).json({ valid: false, message: 'NotFound' });

    if (ticket.status === 'used') {
      return res.status(409).json({ 
        valid: false, 
        message: 'Used', 
        ticket, 
        event: ticket.events?.name,
        scanned_at: ticket.scanned_at
      });
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'used', scanned_at: new Date().toISOString() })
      .eq('id', qr_id);

    if (updateError) throw updateError;

    res.json({ valid: true, ticket, event: ticket.events?.name });
  } catch (error) {
    res.status(500).json({ valid: false, message: 'ServerError' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});