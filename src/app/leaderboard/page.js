'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Link from 'next/link';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboardData() {
      try {
        const { data: profiles } = await supabase.from('profiles').select('*');
        const { data: matches } = await supabase.from('matches').select('*');
        const { data: teams } = await supabase.from('teams').select('*');
        const { data: actualPlayoff } = await supabase.from('playoff_results').select('*');
        const { data: allPredictions } = await supabase.from('user_predictions').select('*');
        const { data: allPlayoffPicks } = await supabase.from('user_playoff_picks').select('*');

        const calculatedScores = profiles.map(profile => {
          let pts = 0;

          const userPreds = allPredictions.filter(p => p.user_id === profile.id);
          userPreds.forEach(pred => {
            const match = matches.find(m => m.id === pred.match_id);
            if (match && match.actual_result === pred.prediction) {
              const pointKey = `points_${pred.prediction.toLowerCase()}`;
              pts += match[pointKey] || 0;
            }
          });

          const userPlayoff = allPlayoffPicks.filter(p => p.user_id === profile.id);
          userPlayoff.forEach(pick => {
            const isCorrect = actualPlayoff?.some(res => res.team_id === pick.team_id && res.stage === pick.stage);
            if (isCorrect) {
              const team = teams.find(t => t.id === pick.team_id);
              if (team) pts += team[`points_${pick.stage}`] || 0;
            }
          });

          return {
            id: profile.id,
            name: profile.full_name || 'Anonym',
            points: pts,
            isSubmitted: profile.is_submitted
          };
        });

        calculatedScores.sort((a, b) => b.points - a.points);
        setLeaderboard(calculatedScores);
      } catch (err) {
        console.error("Fel vid hämtning av leaderboard:", err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboardData();
  }, []);

  if (loading) return <div style={{ padding: '50px' }}>Uppdaterar tabellen...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#1a365d' }}>Leaderboard</h1>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>← Tillbaka till mina tips</Link>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff', textAlign: 'left' }}>
            <th style={{ padding: '15px' }}>Placering</th>
            <th style={{ padding: '15px' }}>Deltagare</th>
            <th style={{ padding: '15px' }}>Status</th>
            <th style={{ padding: '15px' }}>Poäng</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, index) => (
            <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '15px', fontWeight: 'bold' }}>{index + 1}.</td>
              <td style={{ padding: '15px' }}>{entry.name}</td>
              <td style={{ padding: '15px', fontSize: '0.8rem' }}>
                {entry.isSubmitted ? '✅ Inskickat' : '⏳ Utkast'}
              </td>
              <td style={{ padding: '15px', fontWeight: 'bold', color: '#2563eb', fontSize: '1.2rem' }}>
                {entry.points} p
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}