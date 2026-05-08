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
    else window.location.href = "/"; // Skickar dig till huvudsidan
  };

  return (
    <div style={{
      // Inställningar för bakgrundsbilden
      backgroundImage: 'url("/background.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: 'sans-serif'
    }}>
      {/* Mörkt filter ovanpå bilden för att göra texten läsbar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // 40% mörk transparens
        zIndex: 1
      }}></div>

      {/* Inloggningsboxen */}
      <div style={{ 
        padding: '30px', 
        maxWidth: '400px', 
        width: '90%', 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Nästan helt vit bakgrund
        borderRadius: '15px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        zIndex: 2,
        position: 'relative'
      }}>
        <h1 style={{ marginTop: 0, fontSize: '1.5rem', color: '#1e3a8a' }}>Logga in / Ny användare</h1>
        <h4 style={{ fontWeight: 'normal', color: '#475569', fontSize: '0.9rem', marginBottom: '20px' }}>
          Ny användare: skriv in din mejl + lösenord och klicka på Registrera mig
        </h4>

        <input 
          type="email" 
          placeholder="Mejl" 
          onChange={e => setEmail(e.target.value)} 
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }} 
        />
        <input 
          type="password" 
          placeholder="Lösenord" 
          onChange={e => setPassword(e.target.value)} 
          style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e0', boxSizing: 'border-box' }} 
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleLogin} 
            style={{ flex: 1, padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Logga in
          </button>
          <button 
            onClick={handleSignUp} 
            style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Registrera mig
          </button>
        </div>

        {msg && (
          <p style={{ 
            marginTop: '20px', 
            padding: '10px', 
            borderRadius: '6px', 
            backgroundColor: '#fef2f2', 
            color: '#dc2626', 
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}