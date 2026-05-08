'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Link from 'next/link';

export default function Participants() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParticipants() {
      setLoading(true);
      
      // Vi tar bort 'email' här eftersom den kolumnen inte finns i 'profiles'
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, is_submitted');

      if (error) {
        console.error("Supabase Error:", error.message);
        alert("Kunde inte hämta deltagare: " + error.message);
      } else {
        console.log("Alla profiler från DB:", data);
        
        // Filtrera fram de som skickat in (is_submitted)
        const submittedOnes = data ? data.filter(p => p.is_submitted === true) : [];
        
        setParticipants(submittedOnes);
      }
      setLoading(false);
    }
    fetchParticipants();
  }, []);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Laddar deltagare...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Link href="/" style={{ fontSize: '0.9rem', color: '#2563eb', textDecoration: 'none' }}>← Tillbaka till mitt tips</Link>
        <h1 style={{ fontSize: '1.5rem', marginTop: '10px' }}>Inskickade Tips</h1>
        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Här visas endast spelare som har låst sina tips.</p>
      </header>

      <div style={{ display: 'grid', gap: '10px' }}>
        {participants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e0' }}>
            <p style={{ color: '#64748b', margin: 0 }}>Inga låsta tips hittades ännu.</p>
          </div>
        ) : (
          participants.map((p) => (
            <Link 
              key={p.id} 
              href={`/tips/${p.id}`}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '15px', 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '10px',
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {p.username || `Spelare ${p.id.substring(0,4)}`}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#16a34a' }}>✓ Tips inlämnat</span>
              </div>
              <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 'bold' }}>Visa tips →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}