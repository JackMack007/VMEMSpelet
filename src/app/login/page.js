'use client';
import { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    try {
      if (isSignUp) {
        // 1. Enkel validering av användarnamn
        if (!username || username.trim().length < 2) {
          setMsg("Välj ett användarnamn (minst 2 tecken).");
          setLoading(false);
          return;
        }

        // 2. Registrering
        // Vi skickar med username i metadata (display_name). 
        // Database-triggern i Supabase läser detta och skapar din profilrad.
        const { data, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              display_name: username.trim()
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        if (data.user) {
          setMsg("Du kan nu logga in. Välkommen!");
        }
      } else {
        // Inloggningslogik
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        window.location.href = "/"; 
      }
    } catch (err) {
      // Hanterar alla typer av fel (nätverk, lösenordskrav, etc)
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
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
      fontFamily: '-apple-system, sans-serif'
    }}>
      {/* Overlay för att göra texten mer läsbar mot bakgrunden */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)', zIndex: 1
      }}></div>

      <div style={{ 
        padding: '35px 25px', width: '100%', maxWidth: '380px', margin: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: '20px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.4)', zIndex: 2, position: 'relative', boxSizing: 'border-box'
      }}>
        <h1 style={{ marginTop: 0, fontSize: '1.6rem', color: '#1e3a8a', textAlign: 'center', fontWeight: '800' }}>
          VM 2026 Tips
        </h1>
        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.9rem', marginBottom: '25px' }}>
          {isSignUp ? 'Skapa ett konto för att börja tippa' : 'Logga in för att se dina tips'}
        </p>

        <form onSubmit={handleAuth}>
          {isSignUp && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a8a', marginBottom: '5px', textTransform: 'uppercase' }}>Användarnamn</label>
              <input 
                type="text" placeholder="T.ex. Zlatan_99" required
                value={username}
                onChange={e => setUsername(e.target.value)} 
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e0', fontSize: '16px', boxSizing: 'border-box', color: '#000' }} 
              />
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a8a', marginBottom: '5px', textTransform: 'uppercase' }}>E-post</label>
            <input 
              type="email" placeholder="din@mejl.se" required
              value={email}
              onChange={e => setEmail(e.target.value)} 
              style={{ display: 'block', width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e0', fontSize: '16px', boxSizing: 'border-box', color: '#000' }} 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#1e3a8a', marginBottom: '5px', textTransform: 'uppercase' }}>Lösenord</label>
            <input 
              type="password" placeholder="••••••••" required
              value={password}
              onChange={e => setPassword(e.target.value)} 
              style={{ display: 'block', width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e0', fontSize: '16px', boxSizing: 'border-box', color: '#000' }} 
            />
          </div>

          <button 
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '12px', transition: 'background-color 0.2s' }}
          >
            {loading ? 'Vänta...' : (isSignUp ? 'Registrera mig' : 'Logga in')}
          </button>
        </form>
        
        <button 
          onClick={() => { setIsSignUp(!isSignUp); setMsg(''); }} 
          style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          {isSignUp ? 'Har du redan ett konto? Logga in' : 'Inget konto? Skapa ett här'}
        </button>

        {msg && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            borderRadius: '10px', 
            backgroundColor: msg.includes('Bekräfta') ? '#f0fdf4' : '#fef2f2', 
            color: msg.includes('Bekräfta') ? '#16a34a' : '#dc2626', 
            fontSize: '0.85rem', 
            textAlign: 'center', 
            border: '1px solid',
            borderColor: msg.includes('Bekräfta') ? '#bcf0da' : '#fecaca'
          }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}