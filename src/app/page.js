'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton'; 

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  const [groupTips, setGroupTips] = useState({});
  const [playoffPicks, setPlayoffPicks] = useState({
    '16th': [], '8th': [], 'quarter': [], 'semi': [], 'final': [], 'gold': []
  });
  const [tiebreakers, setTiebreakers] = useState({ bronze: '', scorer: '', goals: '' });

  const STAGES = [
    { id: '16th', label: 'Sextondelsfinal', count: 32 },
    { id: '8th', label: 'Åttondelsfinal', count: 16 },
    { id: 'quarter', label: 'Kvartsfinal', count: 8 },
    { id: 'semi', label: 'Semifinal', count: 4 },
    { id: 'final', label: 'Final', count: 2 },
    { id: 'gold', label: 'Världsmästare', count: 1 }
  ];

  useEffect(() => {
    async function initApp() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUser(user);

      try {
        const { data: t } = await supabase.from('teams').select('*').order('group_name').order('name');
        const { data: m } = await supabase.from('matches').select('*').order('match_date');
        const { data: resPlayoff } = await supabase.from('playoff_results').select('*');
        
        setTeams(t || []);
        setMatches(m || []);

        const [predRes, playRes, profRes] = await Promise.all([
          supabase.from('user_predictions').select('*').eq('user_id', user.id),
          supabase.from('user_playoff_picks').select('*').eq('user_id', user.id),
          supabase.from('profiles').select('*').eq('id', user.id).single()
        ]);

        if (profRes.data) {
          setIsLocked(profRes.data.is_submitted || false);
          setIsAdmin(profRes.data.is_admin || false);
          setTiebreakers({
            bronze: profRes.data.tiebreaker_bronze || '',
            scorer: profRes.data.tiebreaker_top_scorer || '',
            goals: profRes.data.tiebreaker_total_goals || ''
          });
        }

        if (predRes.data) {
          const mappedGroup = {};
          predRes.data.forEach(p => mappedGroup[p.match_id] = p.prediction);
          setGroupTips(mappedGroup);
        }

        if (playRes.data) {
          const mappedPlayoff = { '16th': [], '8th': [], 'quarter': [], 'semi': [], 'final': [], 'gold': [] };
          playRes.data.forEach(p => mappedPlayoff[p.stage].push(p.team_id));
          setPlayoffPicks(mappedPlayoff);
        }

        calculatePoints(predRes.data, playRes.data, m, t, resPlayoff);

      } catch (err) {
        console.error("Fel vid laddning:", err.message);
      } finally {
        setLoading(false);
      }
    }
    initApp();
  }, []);

  const formatStaticTime = (dateString) => {
    if (!dateString) return '';
    const [date, time] = dateString.split('T');
    const [year, month, day] = date.split('-');
    const [hour, minute] = time.split(':');
    return `${day}/${month} ${hour}:${minute}`;
  };

  const calculatePoints = (userPreds, userPlayoff, allMatches, allTeams, actualPlayoff) => {
    let pts = 0;
    userPreds?.forEach(pred => {
      const match = allMatches.find(m => m.id === pred.match_id);
      if (match && match.actual_result === pred.prediction) {
        const pointKey = `points_${pred.prediction.toLowerCase()}`;
        pts += match[pointKey] || 0;
      }
    });
    userPlayoff?.forEach(pick => {
      const isCorrect = actualPlayoff?.some(res => res.team_id === pick.team_id && res.stage === pick.stage);
      if (isCorrect) {
        const team = allTeams.find(t => t.id === pick.team_id);
        if (team) pts += team[`points_${pick.stage}`] || 0;
      }
    });
    setTotalPoints(pts);
  };

  const saveTips = async (finalSubmit = false) => {
    if (!user || (isLocked && !finalSubmit)) return;
    if (finalSubmit && !window.confirm("Vill du låsa dina tips? Detta kan inte ändras i efterhand.")) return;

    setLoading(true);
    try {
      const profileData = {
        id: user.id,
        full_name: user.email,
        tiebreaker_top_scorer: tiebreakers.scorer,
        tiebreaker_total_goals: parseInt(tiebreakers.goals) || 0,
        is_submitted: finalSubmit ? true : false
      };
      if (tiebreakers.bronze) profileData.tiebreaker_bronze = tiebreakers.bronze;
      await supabase.from('profiles').upsert(profileData);

      const groupData = Object.entries(groupTips).map(([mId, pred]) => ({
        user_id: user.id, match_id: mId, prediction: pred
      }));
      if (groupData.length > 0) {
        await supabase.from('user_predictions').upsert(groupData, { onConflict: 'user_id, match_id' });
      }

      const playoffData = [];
      Object.entries(playoffPicks).forEach(([stage, ids]) => {
        ids.forEach(tId => playoffData.push({ user_id: user.id, team_id: tId, stage: stage }));
      });
      if (playoffData.length > 0) {
        await supabase.from('user_playoff_picks').delete().eq('user_id', user.id);
        await supabase.from('user_playoff_picks').insert(playoffData);
      }

      if (finalSubmit) setIsLocked(true);
      alert(finalSubmit ? "Tipsen är inskickade och låsta!" : "Utkastet har sparats!");
      window.location.reload(); 
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const togglePlayoffTeam = (stage, teamId, maxCount) => {
    if (isLocked && !isAdmin) return;
    setPlayoffPicks(prev => {
      const current = prev[stage];
      if (current.includes(teamId)) return { ...prev, [stage]: current.filter(id => id !== teamId) };
      if (current.length < maxCount) return { ...prev, [stage]: [...current, teamId] };
      return prev;
    });
  };

  const uniqueGroups = [...new Set(teams.map(t => t.group_name))].sort();

  if (loading) return <div style={{ padding: '50px' }}>Laddar tipsarenan...</div>;

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px', padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '15px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <LogoutButton />
        </div>
        
        <h1>VM 2026 Tips</h1>
        <div style={{ marginBottom: '15px' }}>
          <Link href="/leaderboard" style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '8px' }}>Leaderboard 🏆</Link>
          {isAdmin && <Link href="/admin" style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#64748b', color: '#fff', textDecoration: 'none', borderRadius: '8px' }}>Admin ⚙️</Link>}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>Dina poäng: {totalPoints}</div>
        <p>Inloggad som: {user?.email}</p>
        {isLocked && <div style={{ color: 'red', fontWeight: 'bold', marginTop: '10px' }}>DITT TIPS ÄR LÅST</div>}
      </header>

      <section style={{ marginBottom: '60px', pointerEvents: isLocked ? 'none' : 'auto' }}>
        <h2 style={{ borderBottom: '3px solid #2563eb', paddingBottom: '10px' }}>1. Gruppspel</h2>
        {uniqueGroups.map(group => (
          <div key={group} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#fff' }}>
            <h3 style={{ color: '#1e3a8a', marginTop: 0 }}>{group}</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {matches
                .filter(m => teams.find(t => t.id === m.home_team)?.group_name === group)
                .sort((a, b) => a.match_date.localeCompare(b.match_date))
                .map(match => (
                <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                      {formatStaticTime(match.match_date)}
                    </div>
                    <span style={{ fontWeight: 'bold' }}>{match.home_team} vs {match.away_team}</span>
                    {match.score_text && <span style={{ marginLeft: '10px', color: '#16a34a', fontWeight: 'bold' }}>({match.score_text})</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {['1', 'X', '2'].map(val => (
                      <div key={val} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{match[`points_${val.toLowerCase()}`]}p</div>
                        <button onClick={() => setGroupTips(prev => ({ ...prev, [match.id]: val }))}
                          style={{ 
                            width: '40px', height: '40px', borderRadius: '6px', border: '1px solid #cbd5e0',
                            backgroundColor: groupTips[match.id] === val ? '#2563eb' : '#fff', 
                            color: groupTips[match.id] === val ? '#fff' : '#000',
                            cursor: 'pointer'
                          }}>{val}</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Oppdatert Sluttspill-seksjon med poeng/odds */}
      <section style={{ marginBottom: '60px', pointerEvents: isLocked ? 'none' : 'auto' }}>
        <h2 style={{ borderBottom: '3px solid #2563eb', paddingBottom: '10px' }}>2. Slutspel</h2>
        {STAGES.map(stage => (
          <div key={stage.id} style={{ marginTop: '25px', padding: '20px', backgroundColor: '#f0f9ff', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0 }}>{stage.label} (Välj {stage.count})</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '15px' }}>
              Klicka på ett lag för att välja det. Siffran visar poängen du får om laget går vidare.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {teams.map(team => {
                const isSelected = playoffPicks[stage.id].includes(team.id);
                const stagePoints = team[`points_${stage.id}`] || 0;

                return (
                  <button 
                    key={team.id} 
                    onClick={() => togglePlayoffTeam(stage.id, team.id, stage.count)}
                    style={{ 
                      padding: '10px', 
                      borderRadius: '8px', 
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: isSelected ? '#16a34a' : '#fff', 
                      color: isSelected ? '#fff' : '#000' 
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>{team.name}</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      opacity: 0.9, 
                      backgroundColor: isSelected ? 'rgba(0,0,0,0.2)' : '#f1f5f9',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {stagePoints}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: '50px', padding: '30px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', pointerEvents: isLocked ? 'none' : 'auto' }}>
        <h2 style={{ marginTop: 0 }}>3. Utslagsfrågor</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Bronsvinnare:</label>
            <select value={tiebreakers.bronze} onChange={e => setTiebreakers({...tiebreakers, bronze: e.target.value})} style={{ width: '100%', padding: '12px', marginTop: '5px' }}>
              <option value="">Välj lag...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Skyttekung:</label>
            <input type="text" value={tiebreakers.scorer} onChange={e => setTiebreakers({...tiebreakers, scorer: e.target.value})} style={{ width: '100%', padding: '12px', marginTop: '5px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Totalt antal mål i turneringen:</label>
            <input type="number" value={tiebreakers.goals} onChange={e => setTiebreakers({...tiebreakers, goals: e.target.value})} style={{ width: '100%', padding: '12px', marginTop: '5px' }} />
          </div>
        </div>
      </section>

      {!isLocked && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '50px' }}>
          <button onClick={() => saveTips(false)} style={{ flex: 1, padding: '20px', backgroundColor: '#64748b', color: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>SPARA UTKAST</button>
          <button onClick={() => saveTips(true)} style={{ flex: 1, padding: '20px', backgroundColor: '#1e3a8a', color: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>SKICKA IN OCH LÅS</button>
        </div>
      )}
    </div>
  );
}