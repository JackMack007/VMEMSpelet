'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Link from 'next/link';
import LogoutButton from '../../../components/LogoutButton';

export default function PlayoffAdmin() {
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const STAGES = [
    { id: '16th', label: '16-delsfinal', count: 32 },
    { id: '8th', label: 'Åttondelsfinal', count: 16 },
    { id: 'quarter', label: 'Kvartsfinal', count: 8 },
    { id: 'semi', label: 'Semifinal', count: 4 },
    { id: 'final', label: 'Final', count: 2 },
    { id: 'gold', label: 'Världsmästare', count: 1 }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: t } = await supabase.from('teams').select('*').order('name');
    const { data: r } = await supabase.from('playoff_results').select('*');
    setTeams(t || []);
    setResults(r || []);
    setLoading(false);
  }

  // Sparar poängvärdet för ett lag i en specifik runda
  const updateTeamPoints = async (teamId, stageId, value) => {
    const field = `points_${stageId}`;
    const { error } = await supabase
      .from('teams')
      .update({ [field]: parseInt(value) || 0 })
      .eq('id', teamId);
    
    if (error) alert("Kunde inte uppdatera poäng: " + error.message);
  };

  // Markerar/avmarkerar ett lag som vidare i en runda (Fasit)
  const toggleOfficialResult = async (stage, teamId) => {
    const existingResult = results.find(r => r.stage === stage && r.team_id === teamId);

    if (existingResult) {
      // Om det finns, radera det (avmarkera)
      const { error } = await supabase
        .from('playoff_results')
        .delete()
        .eq('stage', stage)
        .eq('team_id', teamId);

      if (error) {
        alert("Kunde inte ta bort laget: " + error.message);
      }
    } else {
      // Om det inte finns, lägg till det (markera)
      const { error } = await supabase
        .from('playoff_results')
        .insert([{ stage: stage, team_id: teamId }]);

      if (error) {
        alert("Kunde inte lägga till laget: " + error.message);
      }
    }
    
    // Hämta färsk data för att uppdatera UI direkt
    fetchData();
  };

  if (loading) return <div style={{ padding: '50px' }}>Laddar slutspelsinställningar...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Slutspel: Poäng & Fasit (V1.3)</h1>
          <Link href="/admin">← Tillbaka till Adminpanelen</Link>
        </div>
        <LogoutButton />
      </header>

      {STAGES.map(stage => (
        <section key={stage.id} style={{ marginBottom: '60px', padding: '25px', backgroundColor: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ color: '#1e3a8a', borderBottom: '2px solid #cbd5e0', paddingBottom: '10px' }}>
            {stage.label}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Välj lag som gått vidare och ange poäng för detta steg.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' }}>
            {teams.map(team => {
              const isWinner = results.some(r => r.stage === stage.id && r.team_id === team.id);
              
              return (
                <div 
                  key={team.id} 
                  style={{ 
                    padding: '15px', 
                    borderRadius: '10px', 
                    backgroundColor: isWinner ? '#dcfce7' : '#fff',
                    border: isWinner ? '2px solid #22c55e' : '1px solid #cbd5e0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="checkbox" 
                      checked={isWinner} 
                      onChange={() => toggleOfficialResult(stage.id, team.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 'bold' }}>{team.name}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.8rem' }}>Poäng:</label>
                    <input 
                      type="number" 
                      defaultValue={team[`points_${stage.id}`] || 0}
                      onBlur={(e) => updateTeamPoints(team.id, stage.id, e.target.value)}
                      style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}