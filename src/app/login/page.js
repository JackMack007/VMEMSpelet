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
    else setMsg("Kolla din mail för att bekräfta registreringen!");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else window.location.href = "/"; // Sender deg tilbake til hovedsiden
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Logga in / Ny användare</h1>
	  <h2>Ny användare: skriv in din mejl+lösenord och klicka på Registrera mig</h2>
      <input type="email" placeholder="Mejl" onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px' }} />
      <input type="password" placeholder="Lösenord" onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px' }} />
      <button onClick={handleLogin} style={{ marginRight: '10px', padding: '10px' }}>Logga in</button>
      <button onClick={handleSignUp} style={{ padding: '10px' }}>Registrera mig</button>
      <p>{msg}</p>
    </div>
  );
}