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
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    await refreshData();
    setLoading(false);
  }

  async function refreshData() {
    const { data: t } = await supabase.from('teams').select('*').order('name');
    const { data: r } = await supabase.from('playoff_results').select('*');
    if (t) setTeams(t);
    if (r) setResults(r);
  }

  const updateTeamPoints = async (teamId, stageId, value) => {
    const field = `points_${stageId}`;
    const { error } = await supabase
      .from('teams')
      .update({ [field]: parseInt(value) || 0 })
      .eq('id', teamId);
    
    if (error) alert("Poäng-fel: " + error.message);
    else await refreshData();
  };

  const toggleOfficialResult = async (stage, teamId) => {
    const existingResult = results.find(r => r.stage === stage && r.team_id === teamId);
    
    // OPTIMISTISK UPPDATERING: Uppdatera UI direkt för att det ska kännas snabbt
    if (existingResult) {
      setResults(results.filter(r => !(r.stage === stage && r.team_id === teamId)));
    } else {
      setResults([...results, { stage, team_id: teamId }]);
    }

    try {
      if (existingResult) {
        const { error } = await supabase.from('playoff_results')
          .delete()
          .eq('stage', stage)
          .eq('team_id', teamId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('playoff_results')
          .insert([{ stage: stage, team_id: teamId }]);
        if (error) throw error;
      }
    } catch (err) {
      alert("Kunde inte spara i databasen: " + err.message);
      await refreshData(); // Återställ till faktiskt databas-läge om det sket sig
    }
  };

  if (loading) return <div style={{ padding: '50px' }}>Laddar slutspel...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Slutspel: Poäng & Fasit</h1>
          <Link href="/admin" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}>← Tillbaka</Link>
        </div>
        <LogoutButton />
      </header>

      {STAGES.map(stage => (
        <section key={stage.id} style={{ marginBottom: '50px' }}>
          <h2 style={{ color: '#1e3a8a', backgroundColor: '#f1f5f9', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px' }}>
            {stage.label}
          </h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}>Klar</th>
                <th style={{ padding: '10px' }}>Lag</th>
                <th style={{ padding: '10px', width: '120px', textAlign: 'center' }}>Poäng</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => {
                const isWinner = results.some(r => r.stage === stage.id && r.team_id === team.id);
                const currentPoints = team[`points_${stage.id}`] || 0;
                
                return (
                  <tr key={`${stage.id}-${team.id}`} style={{ 
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isWinner ? '#f0fdf4' : 'transparent'
                  }}>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isWinner} 
                        onChange={() => toggleOfficialResult(stage.id, team.id)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px', fontWeight: isWinner ? 'bold' : 'normal' }}>
                      {team.name}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        defaultValue={currentPoints}
                        onBlur={(e) => updateTeamPoints(team.id, stage.id, e.target.value)}
                        style={{ 
                          width: '60px', 
                          padding: '5px', 
                          textAlign: 'center', 
                          borderRadius: '4px', 
                          border: '1px solid #cbd5e0',
                          backgroundColor: currentPoints > 0 ? '#fffbeb' : '#fff'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}