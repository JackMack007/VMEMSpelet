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
    else window.location.href = "/"; 
  };

  return (
    <div style={{
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Mörkt filter ovanpå bilden */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)', 
        zIndex: 1
      }}></div>

      {/* Inloggningsboxen - Responsiv design */}
      <div style={{ 
        padding: '35px 25px', 
        width: '100%',
        maxWidth: '380px', 
        margin: '20px', // Säkerställer marginal på små skärmar
        backgroundColor: 'rgba(255, 255, 255, 0.98)', 
        borderRadius: '20px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
        zIndex: 2,
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <h1 style={{ 
          marginTop: 0, 
          fontSize: '1.6rem', 
          color: '#1e3a8a', 
          textAlign: 'center',
          letterSpacing: '-0.5px'
        }}>
          VM 2026 Tips
        </h1>
        <p style={{ 
          textAlign: 'center', 
          color: '#475569', 
          fontSize: '0.9rem', 
          marginBottom: '25px',
          lineHeight: '1.4'
        }}>
          Logga in eller skapa ett konto genom att lägga in din mejl och lösenord. Klicka därefter på Registrera mig.
        </p>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#1e3a8a', marginBottom: '5px', marginLeft: '2px' }}>MEJL</label>
          <input 
            type="email" 
            placeholder="Mejl" 
            onChange={e => setEmail(e.target.value)} 
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '14px', 
              borderRadius: '10px', 
              border: '1px solid #cbd5e0', 
              fontSize: '16px', // Förhindrar auto-zoom på iOS
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#1e3a8a', marginBottom: '5px', marginLeft: '2px' }}>LÖSENORD</label>
          <input 
            type="password" 
            placeholder="Lösenord" 
            onChange={e => setPassword(e.target.value)} 
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '14px', 
              borderRadius: '10px', 
              border: '1px solid #cbd5e0', 
              fontSize: '16px', 
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>

        <button 
          onClick={handleLogin} 
          style={{ 
            width: '100%', 
            padding: '14px', 
            backgroundColor: '#2563eb', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '10px', 
            fontWeight: 'bold', 
            fontSize: '1rem',
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'background 0.2s'
          }}
        >
          Logga in
        </button>
        
        <button 
          onClick={handleSignUp} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: 'transparent', 
            color: '#64748b', 
            border: '2px solid #e2e8f0', 
            borderRadius: '10px', 
            fontWeight: '600', 
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          Registrera nytt konto
        </button>

        {msg && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            borderRadius: '10px', 
            backgroundColor: msg.includes('Kolla din mail') ? '#f0fdf4' : '#fef2f2', 
            color: msg.includes('Kolla din mail') ? '#16a34a' : '#dc2626', 
            fontSize: '0.85rem',
            textAlign: 'center',
            fontWeight: '500',
            border: msg.includes('Kolla din mail') ? '1px solid #bbf7d0' : '1px solid #fecaca'
          }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}