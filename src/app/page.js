'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton'; 
import GroupTable from '../components/GroupTable'; 

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [actualPlayoffResults, setActualPlayoffResults] = useState([]);
  const [msg, setMsg] = useState('');

  const [openSections, setOpenSections] = useState({ groups: true, playoffs: false, tiebreakers: false });
  const [openGroups, setOpenGroups] = useState({});
  const [showTable, setShowTable] = useState({});

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { window.location.href = "/login"; return; }
      setUser(authUser);

      try {
        const { data: t } = await supabase.from('teams').select('*').order('group_name').order('name');
        const { data: m } = await supabase.from('matches').select('*').order('match_date');
        const { data: resPlayoff } = await supabase.from('playoff_results').select('*');
        
        setTeams(t || []);
        setMatches(m || []);
        setActualPlayoffResults(resPlayoff || []);

        const [predRes, playRes, profRes] = await Promise.all([
          supabase.from('user_predictions').select('*').eq('user_id', authUser.id),
          supabase.from('user_playoff_picks').select('*').eq('user_id', authUser.id),
          supabase.from('profiles').select('*').eq('id', authUser.id).single()
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
          playRes.data.forEach(p => {
            if (mappedPlayoff[p.stage]) mappedPlayoff[p.stage].push(p.team_id.toString());
          });
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

  const calculatePoints = (userPreds, userPlayoff, allMatches, allTeams, actualPlayoff) => {
    let pts = 0;
    userPreds?.forEach(pred => {
      const match = allMatches.find(m => m.id === pred.match_id);
      if (match && match.actual_result === pred.prediction) {
        pts += match[`points_${pred.prediction.toLowerCase()}`] || 0;
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

  const handleGroupTip = async (matchId, val) => {
    if (isLocked) return;
    setGroupTips(prev => ({ ...prev, [matchId]: val }));
    await supabase.from('user_predictions').upsert({
      user_id: user.id, match_id: matchId, prediction: val
    }, { onConflict: 'user_id,match_id' });
  };

  const togglePlayoffTeam = (stage, teamId, maxCount) => {
    if (isLocked) return;
    const teamIdStr = teamId.toString();
    setPlayoffPicks(prev => {
      const current = prev[stage] || [];
      if (current.includes(teamIdStr)) return { ...prev, [stage]: current.filter(id => id !== teamIdStr) };
      if (current.length < maxCount) return { ...prev, [stage]: [...current, teamIdStr] };
      return prev;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setMsg("Sparar...");
    try {
      await supabase.from('user_playoff_picks').delete().eq('user_id', user.id);
      const picksToInsert = [];
      Object.keys(playoffPicks).forEach(stage => {
        playoffPicks[stage].forEach(teamId => {
          picksToInsert.push({ user_id: user.id, stage, team_id: teamId });
        });
      });
      if (picksToInsert.length > 0) await supabase.from('user_playoff_picks').insert(picksToInsert);
      await supabase.from('profiles').update({
        tiebreaker_bronze: tiebreakers.bronze,
        tiebreaker_top_scorer: tiebreakers.scorer,
        tiebreaker_total_goals: parseInt(tiebreakers.goals) || 0
      }).eq('id', user.id);
      setMsg("Allt sparat!");
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg("Fel: " + err.message); }
    finally { setLoading(false); }
  };

  const handleLock = async () => {
    if (!confirm("Är du säker att du vill skicka in ditt tips? Du kan inte ändra efter att du har skickat in.")) return;
    await handleSave();
    const { error } = await supabase.from('profiles').update({ is_submitted: true }).eq('id', user.id);
    if (!error) setIsLocked(true);
  };

  const getTeamName = (teamId) => teams.find(t => t.id.toString() === teamId.toString())?.name || teamId;
  const formatStaticTime = (dateString) => {
    if (!dateString) return '';
    const [date, time] = dateString.split('T');
    const [y, m, d] = date.split('-');
    const [hh, mm] = time.split(':');
    return `${d}/${m} ${hh}:${mm}`;
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Laddar...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif', paddingBottom: '120px' }}>
      <header style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>VM 2026 Tips</h1>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{user?.email}</span>
          </div>
          <LogoutButton />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '15px 0' }}>
          <Link href="/leaderboard" style={{ padding: '8px 15px', backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>🏆 Rank</Link>
          <Link href="/participants" style={{ padding: '8px 15px', backgroundColor: '#10b981', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>👥 Alla Tips</Link>
          {isAdmin && <Link href="/admin" style={{ padding: '8px 15px', backgroundColor: '#64748b', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>⚙️ Admin</Link>}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2563eb' }}>Dina poäng: {totalPoints}</div>
        {isLocked && <div style={{ color: 'red', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '5px' }}>DITT TIPS ÄR LÅST</div>}
        {msg && <div style={{ color: '#2563eb', marginTop: '5px', fontSize: '0.8rem' }}>{msg}</div>}
      </header>

      {/* 1. GRUPPSPEL */}
      <section style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, groups: !p.groups }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          1. Gruppspel {openSections.groups ? '▲' : '▼'}
        </button>
        {openSections.groups && (
          <div style={{ marginTop: '10px' }}>
            {[...new Set(teams.map(t => t.group_name))].sort().map(group => (
              <div key={group} style={{ marginBottom: '5px' }}>
                <button onClick={() => setOpenGroups(p => ({ ...p, [group]: !p[group] }))} style={{ width: '100%', padding: '10px', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  {group} {openGroups[group] ? '−' : '+'}
                </button>
                {openGroups[group] && (
                  <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <button onClick={() => setShowTable(p => ({ ...p, [group]: !p[group] }))} style={{ width: '100%', padding: '8px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px dashed #2563eb', borderRadius: '6px', marginBottom: '10px' }}>
                      {showTable[group] ? 'Dölj Tabell' : 'Visa Tabell'}
                    </button>
                    {showTable[group] && <GroupTable groupName={group} teams={teams} matches={matches} />}
                    {matches.filter(m => teams.find(t => t.id === m.home_team)?.group_name === group).map(match => {
                      const userPick = groupTips[match.id];
                      const actual = match.actual_result;
                      const finished = !!actual;
                      return (
                        <div key={match.id} style={{ marginBottom: '15px', borderBottom: '1px solid #eee' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <div style={{ fontSize: '0.7rem' }}>{formatStaticTime(match.match_date)}</div>
                             {finished && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>Slut: {match.score_text} ({actual})</div>}
                          </div>
                          <div style={{ fontWeight: '500' }}>{getTeamName(match.home_team)} - {getTeamName(match.away_team)}</div>
                          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            {['1', 'X', '2'].map(val => {
                              const isPicked = userPick === val;
                              const isCorrect = actual === val;
                              let bg = '#fff', text = '#000';
                              if (isPicked) {
                                if (!finished) { bg = '#2563eb'; text = '#fff'; }
                                else { bg = isCorrect ? '#16a34a' : '#dc2626'; text = '#fff'; }
                              } else if (finished && isCorrect) {
                                bg = '#f0fdf4'; text = '#16a34a';
                              }
                              return (
                                <button key={val} onClick={() => handleGroupTip(match.id, val)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', backgroundColor: bg, color: text, cursor: isLocked ? 'default' : 'pointer' }}>
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
      </section>

      {/* 2. SLUTSPEL */}
      <section style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, playoffs: !p.playoffs }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          2. Slutspel {openSections.playoffs ? '▲' : '▼'}
        </button>
        {openSections.playoffs && (
          <div style={{ marginTop: '10px' }}>
            {STAGES.map(stage => (
              <div key={stage.id} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>{stage.label} ({playoffPicks[stage.id]?.length || 0}/{stage.count})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {teams.map(team => {
                    const isSelected = playoffPicks[stage.id]?.includes(team.id.toString());
                    const isActuallyAdvancing = actualPlayoffResults.some(r => r.stage === stage.id && r.team_id.toString() === team.id.toString());
                    const stageHasAnyResults = actualPlayoffResults.some(r => r.stage === stage.id);
                    
                    let bg = '#fff', text = '#000', border = '1px solid #bae6fd';

                    if (isSelected) {
                      if (stageHasAnyResults) {
                        bg = isActuallyAdvancing ? '#16a34a' : '#2563eb';
                        text = '#fff';
                        border = isActuallyAdvancing ? '1px solid #16a34a' : '1px solid #2563eb';
                      } else {
                        bg = '#2563eb';
                        text = '#fff';
                        border = '1px solid #2563eb';
                      }
                    } else if (stageHasAnyResults && isActuallyAdvancing) {
                      bg = 'rgba(220, 38, 38, 0.1)'; 
                      text = '#dc2626';
                      border = '1px dashed #dc2626';
                    }

                    return (
                      <button key={team.id} onClick={() => togglePlayoffTeam(stage.id, team.id, stage.count)} 
                        style={{ padding: '6px 2px', borderRadius: '4px', border: border, fontSize: '0.7rem', backgroundColor: bg, color: text, cursor: isLocked ? 'default' : 'pointer' }}>
                        {team.name} ({team[`points_${stage.id}`] || 0}p)
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. SPECIALARE */}
      <section style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, tiebreakers: !p.tiebreakers }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          3. Specialare {openSections.tiebreakers ? '▲' : '▼'}
        </button>
        {openSections.tiebreakers && (
          <div style={{ padding: '15px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0 0 8px 8px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Bronsvinnare</label>
            <select disabled={isLocked} value={tiebreakers.bronze} onChange={e => setTiebreakers({...tiebreakers, bronze: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px', color: '#000' }}>
              <option value="">Välj...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Skyttekung</label>
            <input disabled={isLocked} type="text" value={tiebreakers.scorer} onChange={e => setTiebreakers({...tiebreakers, scorer: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px', color: '#000' }} />
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Totala mål</label>
            <input disabled={isLocked} type="number" value={tiebreakers.goals} onChange={e => setTiebreakers({...tiebreakers, goals: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000' }} />
          </div>
        )}
      </section>

      {!isLocked && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', backgroundColor: '#fff', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', zIndex: 100 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>SPARA</button>
          <button onClick={handleLock} style={{ flex: 1, padding: '12px', backgroundColor: '#1e3a8a', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>LÅS TIPS</button>
        </div>
      )}
    </div>
  );
}