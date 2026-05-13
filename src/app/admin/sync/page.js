'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient'; 
import Link from 'next/link';

export default function AdminSync() {
  const [dbMatches, setDbMatches] = useState([]);
  const [apiResults, setApiResults] = useState({}); // Lagrar API-resultat temporärt { matchId: "2-1" }
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Säkerhetsstatus

  useEffect(() => {
    const checkAdmin = async () => {
      // 1. Hämta användare
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || authError) {
        window.location.href = '/';
        return;
      }

      // 2. Kontrollera is_admin i profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        window.location.href = '/';
        return;
      }

      // 3. Auktoriserad - hämta data
      setIsAdmin(true);
      fetchDbMatches();
    };

    checkAdmin();
  }, []);

  async function fetchDbMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date');
    setDbMatches(data || []);
  }

  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const getResultSign = (h, a) => (h > a ? '1' : h < a ? '2' : 'X');

  // --- STEG 1: BARA HÄMTA FRÅN API (Ingen DB-ändring) ---
  const fetchFromApi = async () => {
    setLoading(true);
    addLog("Hämtar senaste resultat från API...");
    try {
      const res = await fetch('/api/sync?type=matches');
      const apiMatches = await res.json();
      
      if (apiMatches.error) throw new Error(apiMatches.error);

      const resultsMap = {};
      apiMatches.forEach(am => {
        if (am.home_score !== null) {
          resultsMap[am.id.toString()] = {
            score: `${am.home_score}-${am.away_score}`,
            sign: getResultSign(am.home_score, am.away_score)
          };
        }
      });

      setApiResults(resultsMap);
      setHasFetched(true);
      addLog(`Hämtat resultat för ${Object.keys(resultsMap).length} matcher. Se tabellen nedan.`);
    } catch (err) {
      addLog("FEL: " + err.message);
    }
    setLoading(false);
  };

  // --- STEG 2: SYNKA TILL DATABAS (Skriver över m.score_text) ---
  const syncToDatabase = async () => {
    if (!confirm("Vill du skriva över dina manuella resultat med API-datan?")) return;
    
    setLoading(true);
    addLog("Startar synk till databas...");
    let updateCount = 0;

    try {
      for (const m of dbMatches) {
        const apiData = apiResults[m.api_id];
        if (apiData && apiData.score !== m.score_text) {
          const { error } = await supabase
            .from('matches')
            .update({ 
              score_text: apiData.score,
              actual_result: apiData.sign 
            })
            .eq('id', m.id);
          
          if (!error) updateCount++;
        }
      }
      addLog(`Synk klar! Uppdaterade ${updateCount} matcher i databasen.`);
      fetchDbMatches(); // Uppdatera vyn
    } catch (err) {
      addLog("FEL vid sparning: " + err.message);
    }
    setLoading(false);
  };

  // Visa inget förrän vi vet att användaren är admin
  if (!isAdmin) return <div style={{ padding: '50px' }}>Kontrollerar behörighet...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #eee', marginBottom: '20px', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>🔄 Resultat-kontroll</h2>
          <h5 style={{ fontWeight: 'normal', color: '#64748b', margin: '5px 0' }}>
            Kopplat mot api.wc2026api.com. Hämta resultat först, kontrollera DIFF, synka sedan till databasen.
          </h5>
        </div>
        <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>← Tillbaka</Link>
      </header>

      <div style={{ display: 'grid', gap: '20px' }}>
        
        {/* KONTROLLPANEL */}
        <section style={{ display: 'flex', gap: '15px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={fetchFromApi} 
            disabled={loading} 
            style={{ ...btnStyle, backgroundColor: '#2563eb' }}
          >
            {loading ? 'Hämtar...' : '1. Hämta från API'}
          </button>

          <button 
            onClick={syncToDatabase} 
            disabled={loading || !hasFetched} 
            style={{ ...btnStyle, backgroundColor: hasFetched ? '#16a34a' : '#cbd5e1' }}
          >
            2. Synka till Databas
          </button>
        </section>

        {/* SYSTEMLOGG */}
        <div style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '15px', borderRadius: '8px', height: '150px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          {logs.map((log, i) => <div key={i} style={{ borderBottom: '1px solid #1e293b', padding: '2px 0' }}>{log}</div>)}
        </div>

        {/* MATCHTABELL */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', color: '#64748b' }}>
              <th style={{ padding: '12px' }}>Match</th>
              <th style={{ padding: '12px' }}>Nuvarande (DB)</th>
              <th style={{ padding: '12px' }}>API Förslag</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dbMatches.map(m => {
              const apiMatch = apiResults[m.api_id];
              const isDifferent = apiMatch && apiMatch.score !== m.score_text;

              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isDifferent ? '#fffbeb' : 'transparent' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{m.home_team} - {m.away_team}</td>
                  <td style={{ padding: '12px', color: '#64748b' }}>{m.score_text || '-'}</td>
                  <td style={{ padding: '12px' }}>
                    {apiMatch ? (
                      <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{apiMatch.score}</span>
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>Inget resultat</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {isDifferent ? (
                      <span style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 'bold' }}>⚠️ DIFF</span>
                    ) : apiMatch ? (
                      <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>✅ Matchar</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '12px 24px',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'opacity 0.2s'
};