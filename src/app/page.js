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

  const [openSections, setOpenSections] = useState({ groups: true, playoffs: false, tiebreakers: false });
  const [openGroups, setOpenGroups] = useState({});

  const [groupTips, setGroupTips] = useState({});
  const [playoffPicks, setPlayoffPicks] = useState({
    '16th': [], '8th': [], 'quarter': [], 'semi': [], 'final': [], 'gold': []
  });
  const [tiebreakers, setTiebreakers] = useState({ bronze: '', scorer: '', goals: '' });

  const STAGES = [
    { id: '16th', label: '16-delsfinal', count: 32 },
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

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : teamId;
  };

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

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Laddar tipsarenan...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '15px', fontFamily: '-apple-system, sans-serif', paddingBottom: '100px' }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#f1f5f9', 
        borderRadius: '12px', 
        position: 'relative' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>VM 2026 Tips</h1>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{user?.email.split('@')[0]}</span>
          </div>
          <LogoutButton />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
          <Link href="/leaderboard" style={{ padding: '8px 15px', backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '0.9rem' }}>🏆 Rank</Link>
          {isAdmin && <Link href="/admin" style={{ padding: '8px 15px', backgroundColor: '#64748b', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '0.9rem' }}>⚙️ Admin</Link>}
        </div>

        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2563eb' }}>Dina poäng: {totalPoints}</div>
        {isLocked && <div style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '5px' }}>DITT TIPS ÄR LÅST</div>}
      </header>

      {/* SEKTION 1: GRUPPSPEL */}
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => setOpenSections(p => ({ ...p, groups: !p.groups }))}
          style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        >
          1. Gruppspel {openSections.groups ? '▲' : '▼'}
        </button>
        
        {openSections.groups && (
          <div style={{ marginTop: '10px' }}>
            {uniqueGroups.map(group => (
              <div key={group} style={{ marginBottom: '5px' }}>
                <button 
                  onClick={() => toggleGroup(group)}
                  style={{ width: '100%', padding: '10px', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' }}
                >
                  {group} {openGroups[group] ? '−' : '+'}
                </button>
                {openGroups[group] && (
                  <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderTop: 'none', 
                    borderRadius: '0 0 6px 6px',
                    pointerEvents: isLocked ? 'none' : 'auto' // Endast tippa-knapparna låses
                  }}>
                    {matches
                      .filter(m => teams.find(t => t.id === m.home_team)?.group_name === group)
                      .map(match => (
                        <div key={match.id} style={{ marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatStaticTime(match.match_date)}</div>
                          <div style={{ fontWeight: '500', margin: '5px 0' }}>
                            {getTeamName(match.home_team)} - {getTeamName(match.away_team)}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['1', 'X', '2'].map(val => (
                              <button key={val} onClick={() => setGroupTips(prev => ({ ...prev, [match.id]: val }))}
                                style={{ 
                                  flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0',
                                  backgroundColor: groupTips[match.id] === val ? '#2563eb' : '#fff',
                                  color: groupTips[match.id] === val ? '#fff' : '#000',
                                  fontSize: '0.8rem'
                                }}>{val} ({match[`points_${val.toLowerCase()}`]}p)</button>
                            ))}
                          </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEKTION 2: SLUTSPEL */}
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => setOpenSections(p => ({ ...p, playoffs: !p.playoffs }))}
          style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        >
          2. Slutspel {openSections.playoffs ? '▲' : '▼'}
        </button>

        {openSections.playoffs && (
          <div style={{ marginTop: '10px' }}>
            {STAGES.map(stage => (
              <div key={stage.id} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>{stage.label} ({stage.count})</h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '6px',
                  pointerEvents: isLocked ? 'none' : 'auto' // Endast val av lag låses
                }}>
                  {teams.map(team => {
                    const isSelected = playoffPicks[stage.id].includes(team.id);
                    return (
                      <button 
                        key={team.id} 
                        onClick={() => togglePlayoffTeam(stage.id, team.id, stage.count)}
                        style={{ 
                          padding: '6px 2px', borderRadius: '4px', border: '1px solid #bae6fd', fontSize: '0.7rem',
                          backgroundColor: isSelected ? '#16a34a' : '#fff', color: isSelected ? '#fff' : '#000'
                        }}
                      >
                        {team.name} ({team[`points_${stage.id}`] || 0}p)
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEKTION 3: SPECIALARE */}
      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={() => setOpenSections(p => ({ ...p, tiebreakers: !p.tiebreakers }))}
          style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        >
          3. Specialare {openSections.tiebreakers ? '▲' : '▼'}
        </button>
        {openSections.tiebreakers && (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#fffbeb', 
            borderRadius: '0 0 8px 8px', 
            border: '1px solid #fde68a'
          }}>
            <div style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Bronsvinnare</label>
               <select value={tiebreakers.bronze} onChange={e => setTiebreakers({...tiebreakers, bronze: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px' }}>
                 <option value="">Välj...</option>
                 {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Skyttekung</label>
               <input type="text" value={tiebreakers.scorer} onChange={e => setTiebreakers({...tiebreakers, scorer: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Totala mål</label>
               <input type="number" value={tiebreakers.goals} onChange={e => setTiebreakers({...tiebreakers, goals: e.target.value})} style={{ width: '100%', padding: '10px' }} />
            </div>
          </div>
        )}
      </div>

      {!isLocked && (
        <div style={{ display: 'flex', gap: '10px', position: 'fixed', bottom: '0', left: '0', right: '0', padding: '15px', backgroundColor: '#fff', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 100 }}>
          <button onClick={() => saveTips(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>SPARA</button>
          <button onClick={() => saveTips(true)} style={{ flex: 1, padding: '12px', backgroundColor: '#1e3a8a', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>LÅS TIPS</button>
        </div>
      )}
    </div>
  );
}