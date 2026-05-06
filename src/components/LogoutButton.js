'use client';
import { supabase } from '../utils/supabaseClient';

export default function LogoutButton() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Fel vid utloggning: " + error.message);
    } else {
      // Skickar användaren till inloggningssidan
      window.location.href = "/login";
    }
  };

  return (
    <button 
      onClick={handleLogout}
      style={{
        padding: '8px 16px',
        backgroundColor: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e0',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'background 0.2s'
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = '#e2e8f0'}
      onMouseOut={(e) => e.target.style.backgroundColor = '#f1f5f9'}
    >
      Logga ut 🚪
    </button>
  );
}