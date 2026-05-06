'use client';
import { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Sjekk e-posten din for bekreftelseslenke!");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else window.location.href = "/"; // Sender deg tilbake til hovedsiden
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Logg inn / Registrer deg</h1>
      <input type="email" placeholder="E-post" onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px' }} />
      <input type="password" placeholder="Passord" onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px' }} />
      <button onClick={handleLogin} style={{ marginRight: '10px', padding: '10px' }}>Logg inn</button>
      <button onClick={handleSignUp} style={{ padding: '10px' }}>Registrer</button>
      <p>{msg}</p>
    </div>
  );
}