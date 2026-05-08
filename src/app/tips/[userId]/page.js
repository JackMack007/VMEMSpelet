'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function UserTips() {
  const params = useParams();
  const userId = params.userId;

  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [groupTips, setGroupTips] = useState([]);
  const [playoffPicks, setPlayoffPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadUserTips() {
      setLoading(true);
      try {
        // 1. Hämta lag och matcher (behövs för att visa namn)
        const { data: t } = await supabase.from('teams').select('*');
        const { data: m } = await supabase.from('matches').select('*').order('match_date');
        setTeams(t || []);
        setMatches(m || []);

        // 2. Hämta den specifika användarens tips
        const [prof, preds, picks] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase.from('user_predictions').select('*').eq('user_id', userId),
          supabase.from('user_playoff_picks').select('*').eq('user_id', userId)
        ]);

        setProfile(prof.data);
        setGroupTips(preds.data || []);
        setPlayoffPicks(picks.data || []);
        
        console.log("Data laddad för:", userId, { prof, preds, picks });

      } catch (err) {
        console.error("Laddningsfel:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserTips();
  }, [userId]);

  const getTeamName = (id) => teams.find(t => t.id.toString() === id?.toString())?.name || id;

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Hämtar tips...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Link href="/participants" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>← Tillbaka</Link>
        <h1 style={{ fontSize: '1.4rem', margin: '10px 0' }}>Tips: {profile?.username || 'Okänd spelare'}</h1>
      </header>

      {/* GRUPPSPEL */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #eee' }}>Gruppspel</h2>
        {groupTips.length === 0 ? <p>Inga gruppspelstips.</p> : (
          groupTips.map(gt => {
            const match = matches.find(m => m.id === gt.match_id);
            return (
              <div key={gt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
                <span>{match ? `${getTeamName(match.home_team)} - ${getTeamName(match.away_team)}` : 'Laddar match...'}</span>
                <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{gt.prediction}</span>
              </div>
            );
          })
        )}
      </section>

      {/* SLUTSPEL */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #eee' }}>Slutspel</h2>
        {['16th', '8th', 'quarter', 'semi', 'final', 'gold'].map(stage => {
          const stagePicks = playoffPicks.filter(p => p.stage === stage);
          if (stagePicks.length === 0) return null;
          return (
            <div key={stage} style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '5px 0', color: '#64748b', fontSize: '0.8rem' }}>{stage}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {stagePicks.map(p => (
                  <span key={p.id} style={{ padding: '4px 8px', backgroundColor: '#e0f2fe', borderRadius: '4px', fontSize: '0.8rem' }}>
                    {getTeamName(p.team_id)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* SPECIALARE */}
      <section style={{ padding: '15px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 10px 0' }}>Specialare</h2>
        <p><strong>Brons:</strong> {getTeamName(profile?.tiebreaker_bronze)}</p>
        <p><strong>Skyttekung:</strong> {profile?.tiebreaker_top_scorer}</p>
        <p><strong>Totala mål:</strong> {profile?.tiebreaker_total_goals}</p>
      </section>
    </div>
  );
}