'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton'; 
import GroupTable from '../components/GroupTable'; // Importera den nya komponenten

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [actualPlayoffResults, setActualPlayoffResults] = useState([]);

  const [openSections, setOpenSections] = useState({ groups: true, playoffs: false, tiebreakers: false });
  const [openGroups, setOpenGroups] = useState({});
  const [showTable, setShowTable] = useState({}); // State för att visa/dölja tabell per grupp

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
        setActualPlayoffResults(resPlayoff || []);

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
      const isCorrect = actualPlayoff?.some(res => res.team_id.toString() === pick.team_id.toString() && res.stage === pick.stage);
      if (isCorrect) {
        const team = allTeams.find(t => t.id.toString() === pick.team_id.toString());
        if (team) pts += team[`points_${pick.stage}`] || 0;
      }
    });
    setTotalPoints(pts);
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

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Laddar tipsarenan...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '15px', fontFamily: '-apple-system, sans-serif', paddingBottom: '100px' }}>
      <header style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '12px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>VM 2026 Tips</h1>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{user?.email.split('@')[0]}</span>
          </div>
          <LogoutButton />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
          <Link href="/leaderboard" style={{ padding: '8px 15px', backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>🏆 Rank</Link>
          {isAdmin && <Link href="/admin" style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#64748b', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>⚙️ Admin</Link>}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2563eb' }}>Dina poäng: {totalPoints}</div>
        {isLocked && <div style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '5px' }}>DITT TIPS ÄR LÅST</div>}
      </header>

      {/* 1. GRUPPSPEL */}
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, groups: !p.groups }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          1. Gruppspel {openSections.groups ? '▲' : '▼'}
        </button>
        {openSections.groups && (
          <div style={{ marginTop: '10px' }}>
            {[...new Set(teams.map(t => t.group_name))].sort().map(group => (
              <div key={group} style={{ marginBottom: '5px' }}>
                <button onClick={() => toggleGroup(group)} style={{ width: '100%', padding: '10px', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' }}>
                  {group} {openGroups[group] ? '−' : '+'}
                </button>
                {openGroups[group] && (
                  <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                    
                    {/* Knapp för att visa den externa tabellkomponenten */}
                    <button 
                      onClick={() => setShowTable(p => ({ ...p, [group]: !p[group] }))}
                      style={{ width: '100%', padding: '8px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px dashed #2563eb', borderRadius: '6px', marginBottom: '15px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      {showTable[group] ? 'Dölj Tabell' : 'Visa Tabell & Ställning'}
                    </button>

                    {showTable[group] && (
                      <GroupTable groupName={group} teams={teams} matches={matches} />
                    )}

                    {matches.filter(m => teams.find(t => t.id === m.home_team)?.group_name === group).map(match => {
                      const userPick = groupTips[match.id];
                      const actualResult = match.actual_result;
                      const isFinished = !!actualResult;
                      return (
                        <div key={match.id} style={{ marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatStaticTime(match.match_date)}</div>
                            {isFinished && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>Slut: {match.score_text} ({actualResult})</div>}
                          </div>
                          <div style={{ fontWeight: '500', margin: '5px 0' }}>{getTeamName(match.home_team)} - {getTeamName(match.away_team)}</div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['1', 'X', '2'].map(val => {
                              const isPicked = userPick === val;
                              const isCorrect = actualResult === val;
                              let bg = '#fff', text = '#000', border = '1px solid #cbd5e0';
                              
                              if (isPicked) {
                                if (!isFinished) { bg = '#2563eb'; text = '#fff'; border = '1px solid #2563eb'; }
                                else { bg = isCorrect ? '#16a34a' : '#dc2626'; text = '#fff'; border = `1px solid ${isCorrect ? '#16a34a' : '#dc2626'}`; }
                              } else if (isFinished && isCorrect) { bg = '#f0fdf4'; text = '#16a34a'; border = '1px solid #16a34a'; }

                              return (
                                <button key={val} 
                                  onClick={() => !isLocked && setGroupTips(prev => ({ ...prev, [match.id]: val }))} 
                                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: border, backgroundColor: bg, color: text, fontSize: '0.8rem', fontWeight: isPicked ? 'bold' : 'normal', cursor: isLocked ? 'default' : 'pointer', opacity: 1 }}>
                                  {val} ({match[`points_${val.toLowerCase()}`]}p)
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. SLUTSPEL */}
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, playoffs: !p.playoffs }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          2. Slutspel {openSections.playoffs ? '▲' : '▼'}
        </button>
        {openSections.playoffs && (
          <div style={{ marginTop: '10px' }}>
            {STAGES.map(stage => (
              <div key={stage.id} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>{stage.label} ({stage.count})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {teams.map(team => {
                    const isSelected = playoffPicks[stage.id]?.map(id => id.toString()).includes(team.id.toString());
                    const isActuallyAdvancing = actualPlayoffResults.some(r => r.stage === stage.id && r.team_id.toString() === team.id.toString());
                    const stageHasAnyResults = actualPlayoffResults.some(r => r.stage === stage.id);
                    let bg = '#fff', text = '#000', border = '1px solid #bae6fd';

                    if (isSelected) {
                      if (isActuallyAdvancing) { bg = '#16a34a'; text = '#fff'; border = '1px solid #16a34a'; }
                      else { bg = '#2563eb'; text = '#fff'; border = '1px solid #2563eb'; }
                    } else if (stageHasAnyResults && isActuallyAdvancing) {
                      bg = '#fef2f2'; text = '#dc2626'; border = '2px solid #dc2626';
                    }

                    return (
                      <button key={team.id} onClick={() => togglePlayoffTeam(stage.id, team.id, stage.count)} 
                        style={{ padding: '6px 2px', borderRadius: '4px', border: border, fontSize: '0.7rem', backgroundColor: bg, color: text, cursor: isLocked ? 'default' : 'pointer', opacity: 1 }}>
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

      {/* 3. SPECIALARE */}
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, tiebreakers: !p.tiebreakers }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          3. Specialare {openSections.tiebreakers ? '▲' : '▼'}
        </button>
        {openSections.tiebreakers && (
          <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '0 0 8px 8px', border: '1px solid #fde68a' }}>
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Bronsvinnare</label>
               <select disabled={isLocked} value={tiebreakers.bronze} onChange={e => setTiebreakers({...tiebreakers, bronze: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', color: '#000' }}>
                 <option value="">Välj...</option>
                 {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Skyttekung</label>
               <input disabled={isLocked} type="text" value={tiebreakers.scorer} onChange={e => setTiebreakers({...tiebreakers, scorer: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', color: '#000' }} />
               <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Totala mål</label>
               <input disabled={isLocked} type="number" value={tiebreakers.goals} onChange={e => setTiebreakers({...tiebreakers, goals: e.target.value})} style={{ width: '100%', padding: '10px', color: '#000' }} />
          </div>
        )}
      </div>

      {/* Footer-knappar för spara/låsa */}
      {!isLocked && (
        <div style={{ display: 'flex', gap: '10px', position: 'fixed', bottom: '0', left: '0', right: '0', padding: '15px', backgroundColor: '#fff', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 100 }}>
          {/* Sparlogik som i V1.5... */}
          <button onClick={() => {/* ... sparlogik ... */}} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>SPARA</button>
          <button onClick={() => {/* ... låslogik ... */}} style={{ flex: 1, padding: '12px', backgroundColor: '#1e3a8a', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>LÅS TIPS</button>
        </div>
      )}
    </div>
  );
}