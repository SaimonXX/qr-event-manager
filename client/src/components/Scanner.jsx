import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scanner as QrScannerLib } from '@yudiel/react-qr-scanner';
import { api } from '../api/axios';
import toast from 'react-hot-toast';

export default function Scanner() {
  const [scanData, setScanData] = useState(null);
  const [history, setHistory] = useState([]);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('scan_history_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleScan = async (result) => {
    if (paused || !result?.[0]?.rawValue) return;
    const qrId = result[0].rawValue;
    setPaused(true);
    setViewMode(false);
    
    try {
      const { data } = await api.post('/tickets/check', { qr_id: qrId });
      setScanData(data); 
      playAudio('ping');
    } catch (error) {
      const msg = error.response?.data?.error || 'Read Error';
      setScanData({ error: msg });
      playAudio('error');
    }
  };

  const authorizeEntry = async () => {
    if (!scanData?.ticket?.id) return;
    setProcessing(true);
    try {
      await api.post('/scan', { qr_id: scanData.ticket.id });
      toast.success('ENTRY AUTHORIZED');
      playAudio('success');
      
      const updated = { ...scanData, ticket: { ...scanData.ticket, status: 'used', scanned_at: new Date() }, valid: true };
      updateHistory(updated);
      setTimeout(() => reset(), 1500);
    } catch (error) {
      if (error.response?.status === 409) {
        setScanData({ ...scanData, ticket: error.response.data.ticket, error: 'ALREADY USED' });
        playAudio('error');
      } else {
        toast.error('Auth Failed');
      }
    } finally { setProcessing(false); }
  };

  const updateHistory = (record) => {
    const newH = [{ ...record, timestamp: new Date() }, ...history].slice(0, 50);
    setHistory(newH);
    localStorage.setItem('scan_history_v2', JSON.stringify(newH));
  };

  const reset = () => { setScanData(null); setPaused(false); };
  const playAudio = (type) => {
    const audios = {
      ping: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',
      error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'
    };
    new Audio(audios[type]).play().catch(()=>{});
  };

  return (
    <div style={{background:'black', minHeight:'100vh', color:'white', paddingBottom:'6rem'}}>
      <div style={{height:'40vh', borderBottom:'4px solid #333', position:'relative', overflow:'hidden', background:'#111'}}>
        <QrScannerLib onScan={handleScan} scanDelay={500} components={{audio: false}} enabled={!paused} />
        {paused && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center'}}>Scanner Paused</div>}
        <Link to="/" style={{position:'absolute', top:16, left:16, background:'rgba(0,0,0,0.6)', color:'white', padding:'8px 16px', borderRadius:'20px', textDecoration:'none', zIndex:20}}>← Exit</Link>
      </div>

      {scanData && (
        <div className="scan-overlay">
          <div className="card" style={{background:'white', color:'black', width:'90%', maxWidth:'400px', textAlign:'center', position:'relative'}}>
            <div style={{background: scanData.error ? 'var(--error)' : (scanData.ticket?.status === 'used' ? 'var(--warning)' : 'var(--success)'), color:'white', padding:'1rem', borderRadius:'0.5rem 0.5rem 0 0', margin:'-1.5rem -1.5rem 1rem -1.5rem'}}>
              <h2 style={{margin:0}}>{scanData.error ? 'STOP' : (scanData.ticket?.status === 'used' ? 'USED' : 'VALID')}</h2>
              {scanData.error && <small>{scanData.error}</small>}
            </div>

            {scanData.ticket && (
              <div style={{textAlign:'left'}}>
                <h2>{scanData.ticket.guest_name}</h2>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', margin:'1rem 0'}}>
                   <div><small style={{color:'#666'}}>ID NUMBER</small><br/><strong>{scanData.ticket.guest_id_number}</strong></div>
                   <div><small style={{color:'#666'}}>PHONE</small><br/>{scanData.ticket.guest_phone}</div>
                </div>
                <div style={{background:'#f1f5f9', padding:'0.5rem', borderRadius:'0.25rem', fontSize:'0.8rem'}}>
                  Event: {scanData.event}
                </div>
              </div>
            )}

            <div style={{marginTop:'1.5rem', display:'grid', gap:'0.5rem'}}>
              {!viewMode && !scanData.error && scanData.ticket?.status === 'valid' && (
                <button className="btn" style={{background:'var(--success)', fontSize:'1.1rem'}} onClick={authorizeEntry} disabled={processing}>
                  {processing ? 'Processing...' : 'AUTHORIZE ENTRY'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={reset}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'1rem'}}>
        <h3 style={{color:'var(--text-secondary)', borderBottom:'1px solid #333', paddingBottom:'0.5rem', fontSize:'0.9rem'}}>SESSION HISTORY</h3>
        {history.map((h, i) => (
          <div key={i} onClick={() => { setScanData(h); setViewMode(true); setPaused(true); }} style={{display:'flex', justifyContent:'space-between', padding:'0.75rem', borderBottom:'1px solid #222', cursor:'pointer', background:'rgba(255,255,255,0.03)', marginBottom:'0.5rem', borderRadius:'0.25rem'}}>
            <div>
              <strong>{h.ticket?.guest_name || 'Unknown'}</strong>
              <div style={{fontSize:'0.8rem', color:'#888'}}>{h.ticket?.guest_id_number}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <span style={{color: h.error || h.ticket?.status==='used' && !h.valid ? 'var(--error)' : 'var(--success)', fontWeight:'bold', fontSize:'0.8rem'}}>
                {h.error ? 'ERR' : 'OK'}
              </span>
              <div style={{fontSize:'0.7rem', color:'#666'}}>{new Date(h.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}