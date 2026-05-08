'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Link from 'next/link';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateLeaderboard() {
      try {
        // 1. Hämta all nödvändig data för live-beräkning
        const [
          { data: matches },
          { data: teams },
          { data: actualPlayoffs },
          { data: profiles },
          { data: allGroupTips },
          { data: allPlayoffTips }
        ] = await Promise.all([
          supabase.from('matches').select('*'),
          supabase.from('teams').select('*'),
          supabase.from('playoff_results').select('*'),
          supabase.from('profiles').select('id, username, full_name'),
          supabase.from('user_predictions').select('*'),
          supabase.from('user_playoff_picks').select('*')
        ]);

        // 2. Beräkna poäng per användare
        const rankedUsers = profiles.map(profile => {
          let points = 0;

          // Gruppspelspoäng
          const userGroupTips = allGroupTips.filter(t => t.user_id === profile.id);
          userGroupTips.forEach(tip => {
            const match = matches.find(m => m.id === tip.match_id);
            if (match && match.actual_result === tip.prediction) {
              points += match[`points_${tip.prediction.toLowerCase()}`] || 0;
            }
          });

          // Slutspelspoäng
          const userPlayoffTips = allPlayoffTips.filter(t => t.user_id === profile.id);
          userPlayoffTips.forEach(pick => {
            const isCorrect = actualPlayoffs.some(res => 
              res.team_id.toString() === pick.team_id.toString() && res.stage === pick.stage
            );
            if (isCorrect) {
              const team = teams.find(t => t.id.toString() === pick.team_id.toString());
              if (team) points += team[`points_${pick.stage}`] || 0;
            }
          });

          return {
            name: profile.username || profile.full_name?.split('@')[0] || 'Anonym',
            points: points
          };
        });

        // 3. Sortera: Flest poäng först
        setLeaderboard(rankedUsers.sort((a, b) => b.points - a.points));
      } catch (err) {
        console.error("Leaderboard-fel:", err);
      } finally {
        setLoading(false);
      }
    }

    calculateLeaderboard();
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Beräknar ställning...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '15px', fontFamily: '-apple-system, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 'bold' }}>← Hem</Link>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1.5rem', margin: 0, paddingRight: '50px' }}>Ranking 🏆</h1>
      </header>

      <div style={{ backgroundColor: '#fff', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
              <th style={{ padding: '15px 10px', textAlign: 'center', width: '50px' }}>#</th>
              <th style={{ padding: '15px 10px', textAlign: 'left' }}>Spelare</th>
              <th style={{ padding: '15px 10px', textAlign: 'right', width: '80px' }}>Poäng</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => {
              const isTop3 = index < 3;
              return (
                <tr key={index} style={{ 
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: index === 0 ? '#fef3c7' : 'transparent'
                }}>
                  <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: isTop3 ? '#1e3a8a' : '#64748b' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </td>
                  <td style={{ padding: '15px 10px' }}>
                    <span style={{ fontWeight: isTop3 ? 'bold' : '500', color: '#1e293b' }}>{user.name}</span>
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb', fontSize: '1.1rem' }}>
                    {user.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '20px' }}>
        Tabellen uppdateras live baserat på registrerade matchresultat.
      </p>
    </div>
  );
}