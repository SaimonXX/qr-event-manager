import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabaseClient';

const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TicketGenerator = lazy(() => import('./components/TicketGenerator'));
const ClaimTicket = lazy(() => import('./components/ClaimTicket'));
const Scanner = lazy(() => import('./components/Scanner'));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{display:'flex', justifyContent:'center', marginTop:'5rem'}}>Loading...</div>;

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      <Suspense fallback={<div>Loading component...</div>}>
        <Routes>
          <Route path="/claim/:id" element={<ClaimTicket />} />
          <Route path="/" element={user ? <Dashboard user={user} /> : <Login onLogin={setUser} />} />
          <Route path="/event/:id" element={user ? <TicketGenerator /> : <Navigate to="/" />} />
          <Route path="/scanner" element={user ? <Scanner /> : <Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;