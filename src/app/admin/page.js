'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Link from 'next/link';
import LogoutButton from '../../components/LogoutButton';

export default function AdminDashboard() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // States for nye data
  const [newTeam, setNewTeam] = useState({ id: '', name: '', group_name: '' });
  const [matchInputs, setMatchInputs] = useState({}); 

  // States for redigering
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      // 1. Hämta aktuell användare
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || authError) {
        window.location.href = '/';
        return;
      }

      // 2. Kontrollera admin-status i profiles-tabellen
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        console.error("Ej behörig eller fel vid kontroll");
        window.location.href = '/';
        return;
      }

      // 3. Om vi nått hit är användaren admin
      setIsAdmin(true);
      fetchData();
    };

    checkAdmin();
  }, []);

  async function fetchData() {
    const { data: t } = await supabase.from('teams').select('*').order('group_name').order('name');
    const { data: m } = await supabase.from('matches').select('*').order('match_date');
    
    setTeams(t || []);
    setMatches(m || []);
    setLoading(false);
  }

  // HJÄLPFUNKTION: Statisk tidsvisning utan tidszonskonvertering
  const formatStaticTime = (dateString) => {
    if (!dateString) return '';
    const [date, time] = dateString.split('T');
    const [year, month, day] = date.split('-');
    const [hour, minute] = time.split(':');
    return `${day}/${month} ${hour}:${minute}`;
  };

  const generateMatchId = (groupName) => {
    const groupLetter = groupName.replace('Grupp ', '').charAt(0).toUpperCase();
    const groupIds = matches
      .map(m => m.id)
      .filter(id => id.startsWith(groupLetter))
      .map(id => parseInt(id.replace(groupLetter, '')))
      .filter(num => !isNaN(num));
    const nextNum = groupIds.length > 0 ? Math.max(...groupIds) + 1 : 1;
    return `${groupLetter}${nextNum}`;
  };

  // --- DATABASHANTERING (CRUD) ---

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    const { error } = await supabase.from('teams').update({ 
      name: editingTeam.name, 
      group_name: editingTeam.group_name 
    }).eq('id', editingTeam.id);
    if (error) alert(error.message);
    else { setEditingTeam(null); fetchData(); }
  };

  const handleUpdateMatch = async () => {
    if (!editingMatch) return;
    const { error } = await supabase.from('matches').update({ 
      home_team: editingMatch.home_team, 
      away_team: editingMatch.away_team,
      match_date: editingMatch.match_date,
      points_1: parseInt(editingMatch.points_1) || 0,
      points_x: parseInt(editingMatch.points_x) || 0,
      points_2: parseInt(editingMatch.points_2) || 0
    }).eq('id', editingMatch.id);
    if (error) alert(error.message);
    else { setEditingMatch(null); fetchData(); }
  };

  const handleUpdateMatchScore = async (matchId, score) => {
    if (!score || score.trim() === "") {
      await supabase.from('matches').update({ score_text: null, actual_result: null }).eq('id', matchId);
      fetchData();
      return;
    }
    const parts = score.split('-');
    if (parts.length !== 2) { fetchData(); return; }
    const home = parseInt(parts[0]);
    const away = parseInt(parts[1]);
    let winner = home > away ? '1' : home < away ? '2' : 'X';
    await supabase.from('matches').update({ score_text: score, actual_result: winner }).eq('id', matchId);
    fetchData();
  };

  const handleAddMatchInGroup = async (groupName) => {
    const input = matchInputs[groupName] || {};
    if (!input.home_team || !input.away_team || !input.match_date || !input.p1 || !input.px || !input.p2) {
      alert("Vänligen fyll i alla fält.");
      return;
    }
    const autoId = generateMatchId(groupName);
    const { error } = await supabase.from('matches').insert([{
      id: autoId, home_team: input.home_team, away_team: input.away_team,
      match_date: input.match_date, points_1: parseInt(input.p1),
      points_x: parseInt(input.px), points_2: parseInt(input.p2)
    }]);
    if (error) alert(error.message);
    else { setMatchInputs({...matchInputs, [groupName]: {}}); fetchData(); }
  };

  const handleDelete = async (table, id) => {
    if (!confirm(`Vill du radera ${id}?`)) return;
    try {
      if (table === 'teams') {
        const { data: relatedMatches } = await supabase.from('matches').select('id').or(`home_team.eq.${id},away_team.eq.${id}`);
        if (relatedMatches?.length > 0) {
          const mIds = relatedMatches.map(m => m.id);
          await supabase.from('user_predictions').delete().in('match_id', mIds);
          await supabase.from('matches').delete().in('id', mIds);
        }
      }
      if (table === 'matches') await supabase.from('user_predictions').delete().eq('match_id', id);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const uniqueGroups = [...new Set(teams.map(t => t.group_name))].sort();

  if (!isAdmin || loading) return <div style={{ padding: '50px' }}>Kontrollerar behörighet...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Turneringsadmin</h1>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <Link href="/">← Tillbaka till tipsen</Link>
            <LogoutButton />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link 
            href="/admin/sync" 
            style={{ 
              background: '#2563eb', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              textDecoration: 'none',
              fontWeight: 'bold' 
            }}
          >
            Synka Resultat 🔄
          </Link>
          <Link 
            href="/admin/playoff" 
            style={{ 
              background: '#805ad5', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              textDecoration: 'none',
              fontWeight: 'bold' 
            }}
          >
            Slutspel & Poäng 🏆
          </Link>
          <Link 
            href="/admin/users" 
            style={{ 
              background: '#2b6cb0', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              textDecoration: 'none',
              fontWeight: 'bold' 
            }}
          >
            Hantera Användare 👥
          </Link>
        </div>
      </header>

      {/* SKAPA LAG */}
      <section style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '40px' }}>
        <h2>Skapa nytt lag</h2>
        <form onSubmit={(e) => { e.preventDefault(); supabase.from('teams').insert([newTeam]).then(fetchData); setNewTeam({id:'', name:'', group_name:''}); }} style={{ display: 'flex', gap: '10px' }}>
          <input placeholder="ID (t.ex. SWE)" value={newTeam.id || ''} onChange={e => setNewTeam({...newTeam, id: e.target.value.toUpperCase()})} required />
          <input placeholder="Namn" value={newTeam.name || ''} onChange={e => setNewTeam({...newTeam, name: e.target.value})} required />
          <input placeholder="Grupp" value={newTeam.group_name || ''} onChange={e => setNewTeam({...newTeam, group_name: e.target.value})} required />
          <button type="submit" style={{ background: '#38a169', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>Spara</button>
        </form>
      </section>

      {uniqueGroups.map(group => (
        <div key={group} style={{ marginBottom: '50px', padding: '25px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <h2 style={{ color: '#1e3a8a', marginTop: 0 }}>{group}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.3fr', gap: '30px' }}>
            {/* LAGLISTA */}
            <div>
              <h4>Lag</h4>
              {teams.filter(t => t.group_name === group).map(t => (
                <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  {editingTeam?.id === t.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <input value={editingTeam.name || ''} onChange={e => setEditingTeam({...editingTeam, name: e.target.value})} placeholder="Namn" />
                      <input value={editingTeam.group_name || ''} onChange={e => setEditingTeam({...editingTeam, group_name: e.target.value})} placeholder="Grupp" />
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={handleUpdateTeam} style={{ background: '#38a169', color: 'white', border: 'none', padding: '2px 8px', borderRadius: '4px' }}>Spara</button>
                        <button onClick={() => setEditingTeam(null)} style={{ background: '#94a3b8', color: 'white', border: 'none', padding: '2px 8px', borderRadius: '4px' }}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{t.id}</strong>: {t.name}</span>
                      <div>
                        <button onClick={() => setEditingTeam(t)} style={{ color: '#3182ce', border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px' }}>✎</button>
                        <button onClick={() => handleDelete('teams', t.id)} style={{ color: '#e53e3e', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* MATCHER */}
            <div>
              <h4>Matcher</h4>
              <table style={{ width: '100%', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>
                    <th>ID</th>
                    <th>Tid</th>
                    <th>Match</th>
                    <th style={{ textAlign: 'center' }}>1 - X - 2</th>
                    <th>Resultat</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .filter(m => teams.find(t => t.id === m.home_team)?.group_name === group)
                    .sort((a, b) => a.match_date.localeCompare(b.match_date))
                    .map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {editingMatch?.id === m.id ? (
                        <td colSpan="6">
                          <div style={{ display: 'grid', gap: '5px', padding: '10px', background: '#f8fafc' }}>
                            <select value={editingMatch.home_team || ''} onChange={e => setEditingMatch({...editingMatch, home_team: e.target.value})}>
                              {teams.filter(t => t.group_name === group).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={editingMatch.away_team || ''} onChange={e => setEditingMatch({...editingMatch, away_team: e.target.value})}>
                              {teams.filter(t => t.group_name === group).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <input type="datetime-local" value={editingMatch.match_date?.substring(0,16) || ''} onChange={e => setEditingMatch({...editingMatch, match_date: e.target.value})} />
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <input placeholder="P1" type="number" value={editingMatch.points_1 || ''} onChange={e => setEditingMatch({...editingMatch, points_1: e.target.value})} style={{width: '40px'}} />
                              <input placeholder="PX" type="number" value={editingMatch.points_x || ''} onChange={e => setEditingMatch({...editingMatch, points_x: e.target.value})} style={{width: '40px'}} />
                              <input placeholder="P2" type="number" value={editingMatch.points_2 || ''} onChange={e => setEditingMatch({...editingMatch, points_2: e.target.value})} style={{width: '40px'}} />
                              <button onClick={handleUpdateMatch} style={{ background: '#38a169', color: 'white', border: 'none', padding: '2px 8px' }}>Spara</button>
                              <button onClick={() => setEditingMatch(null)} style={{ background: '#94a3b8', color: 'white', border: 'none', padding: '2px 8px' }}>✕</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td style={{ fontSize: '0.8rem', width: '30px' }}>{m.id}</td>
                          <td style={{ fontSize: '0.85rem', width: '100px' }}>{formatStaticTime(m.match_date)}</td>
                          <td style={{ fontWeight: '500' }}>{m.home_team} - {m.away_team}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.85rem', color: '#2563eb' }}>
                            {m.points_1} - {m.points_x} - {m.points_2}
                          </td>
                          <td>
                            <input 
                              placeholder="0-0" 
                              defaultValue={m.score_text || ''} 
                              onBlur={(e) => handleUpdateMatchScore(m.id, e.target.value)} 
                              style={{ width: '40px', textAlign: 'center' }} 
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => setEditingMatch(m)} style={{ color: '#3182ce', border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px' }}>✎</button>
                            <button onClick={() => handleDelete('matches', m.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* LÄGG TILL MATCH FORMULÄR */}
              <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <h5 style={{ marginTop: 0 }}>Lägg till match i {group}</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <select 
                    onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), home_team: e.target.value}})} 
                    value={matchInputs[group]?.home_team || ''}
                  >
                    <option value="">Hemmalag</option>
                    {teams.filter(t => t.group_name === group).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select 
                    onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), away_team: e.target.value}})} 
                    value={matchInputs[group]?.away_team || ''}
                  >
                    <option value="">Bortalag</option>
                    {teams.filter(t => t.group_name === group).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input 
                    type="datetime-local" 
                    style={{ flex: 2 }} 
                    onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), match_date: e.target.value}})} 
                    value={matchInputs[group]?.match_date || ''}
                  />
                  <input placeholder="P1" style={{ width: '40px' }} type="number" onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), p1: e.target.value}})} value={matchInputs[group]?.p1 || ''} />
                  <input placeholder="PX" style={{ width: '40px' }} type="number" onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), px: e.target.value}})} value={matchInputs[group]?.px || ''} />
                  <input placeholder="P2" style={{ width: '40px' }} type="number" onChange={e => setMatchInputs({...matchInputs, [group]: {...(matchInputs[group] || {}), p2: e.target.value}})} value={matchInputs[group]?.p2 || ''} />
                </div>
                <button onClick={() => handleAddMatchInGroup(group)} style={{ width: '100%', background: '#2b6cb0', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Skapa match</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}