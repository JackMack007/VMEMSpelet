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

  const STAGES = [
    { id: '16th', label: '16-delsfinal', count: 32 },
    { id: '8th', label: 'Åttondelsfinal', count: 16 },
    { id: 'quarter', label: 'Kvartsfinal', count: 8 },
    { id: 'semi', label: 'Semifinal', count: 4 },
    { id: 'final', label: 'Final', count: 2 },
    { id: 'gold', label: 'Världsmästare', count: 1 }
  ];

  // --- NYTT: STATES FÖR VIEW-MINNE ---
  const [openSections, setOpenSections] = useState({ groups: true, playoffs: false, tiebreakers: false });
  const [openGroups, setOpenGroups] = useState({});
  const [showTable, setShowTable] = useState({});
  const [isReady, setIsReady] = useState(false); // Hindrar overwrite vid första load

  const [groupTips, setGroupTips] = useState({});
  const [playoffPicks, setPlayoffPicks] = useState({ '16th': [], '8th': [], 'quarter': [], 'semi': [], 'final': [], 'gold': [] });
  const [tiebreakers, setTiebreakers] = useState({ bronze: '', scorer: '', goals: '' });

  // 1. Ladda minne vid start
  useEffect(() => {
    const savedSections = localStorage.getItem('vm_open_sections');
    const savedGroups = localStorage.getItem('vm_open_groups');
    const savedTables = localStorage.getItem('vm_show_tables');

    if (savedSections) setOpenSections(JSON.parse(savedSections));
    if (savedGroups) setOpenGroups(JSON.parse(savedGroups));
    if (savedTables) setShowTable(JSON.parse(savedTables));
    
    setIsReady(true);
  }, []);

  // 2. Spara minne vid ändring
  useEffect(() => {
    if (isReady) {
      localStorage.setItem('vm_open_sections', JSON.stringify(openSections));
      localStorage.setItem('vm_open_groups', JSON.stringify(openGroups));
      localStorage.setItem('vm_show_tables', JSON.stringify(showTable));
    }
  }, [openSections, openGroups, showTable, isReady]);

  useEffect(() => {
    async function initApp() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      setUser(session.user);

      try {
        const { data: t } = await supabase.from('teams').select('*').order('group_name').order('name');
        const { data: m } = await supabase.from('matches').select('*').order('match_date');
        const { data: resPlayoff } = await supabase.from('playoff_results').select('*');
        
        setTeams(t || []);
        setMatches(m || []);
        setActualPlayoffResults(resPlayoff || []);

        const [predRes, playRes, profRes] = await Promise.all([
          supabase.from('user_predictions').select('*').eq('user_id', session.user.id),
          supabase.from('user_playoff_picks').select('*').eq('user_id', session.user.id),
          supabase.from('profiles').select('*').eq('id', session.user.id).single()
        ]);

        if (profRes.data) {
          setIsLocked(profRes.data.is_submitted || false);
          setIsAdmin(profRes.data.is_admin || false);
          setTiebreakers({ bronze: profRes.data.tiebreaker_bronze || '', scorer: profRes.data.tiebreaker_top_scorer || '', goals: profRes.data.tiebreaker_total_goals || '' });
        }
        if (predRes.data) {
          const mappedGroup = {};
          predRes.data.forEach(p => mappedGroup[p.match_id] = p.prediction);
          setGroupTips(mappedGroup);
        }
        if (playRes.data) {
          const mappedPlayoff = { '16th': [], '8th': [], 'quarter': [], 'semi': [], 'final': [], 'gold': [] };
          playRes.data.forEach(p => { if (mappedPlayoff[p.stage]) mappedPlayoff[p.stage].push(p.team_id.toString()); });
          setPlayoffPicks(mappedPlayoff);
        }
        
        calculatePoints(predRes.data || [], playRes.data || [], m || [], t || [], resPlayoff || []);

      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    initApp();
  }, []);

  const calculatePoints = (userPreds, userPlayoff, allMatches, allTeams, actualPlayoff) => {
    let pts = 0;
    userPreds?.forEach(p => {
      const match = allMatches.find(m => m.id === p.match_id);
      if (match && match.actual_result === p.prediction) pts += match[`points_${p.prediction.toLowerCase()}`] || 0;
    });
    userPlayoff?.forEach(p => {
      const isCorrect = actualPlayoff.some(r => r.team_id.toString() === p.team_id.toString() && r.stage === p.stage);
      if (isCorrect) {
        const team = allTeams.find(t => t.id.toString() === p.team_id.toString());
        if (team) pts += team[`points_${p.stage}`] || 0;
      }
    });
    setTotalPoints(pts);
  };

  const handleGroupTip = async (matchId, val) => {
    if (isLocked) return;
    setGroupTips(prev => ({ ...prev, [matchId]: val }));
    await supabase.from('user_predictions').upsert({ user_id: user.id, match_id: matchId, prediction: val }, { onConflict: 'user_id,match_id' });
  };

  const togglePlayoffTeam = async (stage, teamId, maxCount) => {
    if (isLocked || !user) return;
    const teamIdStr = teamId.toString();
    const currentPicks = playoffPicks[stage] || [];
    const isAlreadySelected = currentPicks.includes(teamIdStr);
    if (!isAlreadySelected && currentPicks.length >= maxCount) return;

    const newPicks = isAlreadySelected ? currentPicks.filter(id => id !== teamIdStr) : [...currentPicks, teamIdStr];
    setOpenSections(prev => ({ ...prev })); // Behåller befintlig state-struktur intakt
    setPlayoffPicks(prev => ({ ...prev, [stage]: newPicks }));

    try {
      await supabase.from('user_playoff_picks').delete().eq('user_id', user.id).eq('stage', stage).eq('team_id', teamIdStr);
      if (!isAlreadySelected) {
        const { error } = await supabase.from('user_playoff_picks').insert({ user_id: user.id, stage, team_id: teamIdStr });
        if (error) throw error;
      }
      setMsg("Val sparat!");
      setTimeout(() => setMsg(''), 1000);
    } catch (err) {
      setPlayoffPicks(prev => ({ ...prev, [stage]: currentPicks }));
      setMsg("Kunde inte spara.");
    }
  };

  // --- UPPDATERAD: TVINGAR TOMMA STRÄNGAR TILL NULL FÖR ATT UNDVIKA 409 CONFLICT OCH NaN ---
  const handleSave = async () => {
    setLoading(true);
    try {
      const cleanData = {
        tiebreaker_bronze: tiebreakers.bronze === "" ? null : tiebreakers.bronze,
        tiebreaker_top_scorer: tiebreakers.scorer === "" ? null : tiebreakers.scorer,
        tiebreaker_total_goals: tiebreakers.goals === "" ? null : (parseInt(tiebreakers.goals) || 0)
      };

      const { error } = await supabase
        .from('profiles')
        .update(cleanData)
        .eq('id', user.id);

      if (error) throw error;

      setMsg("Sparat!");
    } catch (err) { 
      console.error("Detta gick fel i Supabase:", err);
      setMsg("Fel: " + (err.message || "Kunde inte spara")); 
    }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000); }
  };

  const getTeamName = (teamId) => teams.find(t => t.id.toString() === teamId.toString())?.name || teamId;
  
  const formatStaticTime = (dateString) => {
    if (!dateString) return '';
    const [date, time] = dateString.split('T');
    const [hh, mm] = time.split(':');
    const [y, m, d] = date.split('-');
    return `${d}/${m} ${hh}:${mm}`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Laddar...</div>;

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
          {isAdmin && (
            <Link href="/admin" style={{ padding: '8px 15px', backgroundColor: '#64748b', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '0.9rem' }}>⚙️ Admin</Link>
          )}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2563eb' }}>Poäng: {totalPoints}</div>
        {isLocked && <div style={{ color: 'red', fontWeight: 'bold' }}>LÅST</div>}
        {msg && <div style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '0.8rem' }}>{msg}</div>}
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ fontSize: '0.7rem' }}>{formatStaticTime(match.match_date)}</div>
                             {finished && (
                               <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>
                                 Slutresultat: {match.score_text} ({actual})
                               </div>
                             )}
                          </div>
                          <div style={{ fontWeight: '500' }}>{getTeamName(match.home_team)} - {getTeamName(match.away_team)}</div>
                          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            {['1', 'X', '2'].map(val => {
                              const isPicked = userPick === val;
                              const isCorrect = actual === val;
                              let bg = '#fff', text = '#000', border = '1px solid #cbd5e0';
                              
                              if (isPicked) {
                                if (!finished) { bg = '#2563eb'; text = '#fff'; }
                                else { bg = isCorrect ? '#16a34a' : '#dc2626'; text = '#fff'; }
                              } else if (finished && isCorrect) {
                                bg = '#f0fdf4'; text = '#16a34a'; border = '1px solid #16a34a';
                              }

                              return (
                                <button key={val} onClick={() => handleGroupTip(match.id, val)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border, backgroundColor: bg, color: text, fontSize: '0.8rem' }}>
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
            {STAGES.map(stage => {
              const groupNames = [...new Set(teams.map(t => t.group_name))].sort();
              return (
                <div key={stage.id} style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #bae6fd', paddingBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0369a1', fontWeight: 'bold' }}>{stage.label}</h4>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{playoffPicks[stage.id]?.length || 0} / {stage.count}</span>
                  </div>
                  {groupNames.map(group => (
                    <div key={group} style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b', marginBottom: '8px', padding: '2px 8px', borderLeft: '4px solid #2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>Grupp {group}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                        {teams.filter(t => t.group_name === group).map(team => {
                          const isSelected = (playoffPicks[stage.id] || []).includes(team.id.toString());
                          const isCorrect = actualPlayoffResults.some(r => r.stage === stage.id && r.team_id.toString() === team.id.toString());
                          const hasResults = actualPlayoffResults.some(r => r.stage === stage.id);
                          let bg = '#fff', text = '#000', border = '1px solid #cbd5e0';
                          if (isSelected) {
                             bg = !hasResults ? '#2563eb' : (isCorrect ? '#16a34a' : '#2563eb');
                             text = '#fff';
                          } else if (hasResults && isCorrect) {
                             bg = 'rgba(220, 38, 38, 0.1)'; text = '#dc2626'; border = '1px dashed #dc2626';
                          }
                          return (
                            <button key={team.id} onClick={() => togglePlayoffTeam(stage.id, team.id, stage.count)} style={{ padding: '10px 4px', borderRadius: '6px', border, fontSize: '0.75rem', backgroundColor: bg, color: text }}>
                              <div style={{ fontWeight: isSelected ? '800' : '500' }}>{team.name}</div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>{team[`points_${stage.id}`]}p</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. SPECIALARE */}
      <section style={{ marginBottom: '10px' }}>
        <button onClick={() => setOpenSections(p => ({ ...p, tiebreakers: !p.tiebreakers }))} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          3. Specialare {openSections.tiebreakers ? '▲' : '▼'}
        </button>
        {openSections.tiebreakers && (
          <div style={{ padding: '15px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem' }}>Bronsvinnare</label>
            <select disabled={isLocked} value={tiebreakers.bronze} onChange={e => setTiebreakers({...tiebreakers, bronze: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px', color: '#000' }}>
              <option value="">Välj...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem' }}>Skyttekung</label>
            <input disabled={isLocked} type="text" value={tiebreakers.scorer} onChange={e => setTiebreakers({...tiebreakers, scorer: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px', color: '#000' }} />
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem' }}>Totala mål</label>
            <input disabled={isLocked} type="number" value={tiebreakers.goals} onChange={e => setTiebreakers({...tiebreakers, goals: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000' }} />
          </div>
        )}
      </section>

      {!isLocked && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', backgroundColor: '#fff', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', zIndex: 100 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>SPARA</button>
          <button onClick={() => { if(confirm("Vill du låsa?")) { handleSave(); supabase.from('profiles').update({ is_submitted: true }).eq('id', user.id).then(() => setIsLocked(true)); } }} style={{ flex: 1, padding: '12px', backgroundColor: '#1e3a8a', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>SKICKA IN</button>
        </div>
      )}
    </div>
  );
}