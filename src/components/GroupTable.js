'use client';

export default function GroupTable({ groupName, teams, matches }) {
  // Beräkna tabellen internt i komponenten
  const groupTeams = teams.filter(t => t.group_name === groupName);
  
  const table = groupTeams.map(team => ({
    name: team.name,
    id: team.id,
    played: 0, v: 0, o: 0, f: 0, goalDiff: 0, points: 0
  }));

  matches.forEach(m => {
    const homeTeam = table.find(t => t.id === m.home_team);
    const awayTeam = table.find(t => t.id === m.away_team);

    if (homeTeam && awayTeam && m.actual_result && m.score_text) {
      const scores = m.score_text.split('-').map(s => parseInt(s.trim()));
      if (scores.length === 2) {
        const homeGoals = scores[0];
        const awayGoals = scores[1];

        homeTeam.played++;
        awayTeam.played++;
        homeTeam.goalDiff += (homeGoals - awayGoals);
        awayTeam.goalDiff += (awayGoals - homeGoals);

        if (m.actual_result === '1') {
          homeTeam.v++; homeTeam.points += 3;
          awayTeam.f++;
        } else if (m.actual_result === '2') {
          awayTeam.v++; awayTeam.points += 3;
          homeTeam.f++;
        } else if (m.actual_result === 'X') {
          homeTeam.o++; homeTeam.points += 1;
          awayTeam.o++; awayTeam.points += 1;
        }
      }
    }
  });

  const sortedTable = table.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);

  return (
    <div style={{ marginBottom: '20px', overflowX: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '5px' }}>Lag</th>
            <th>S</th><th>V</th><th>O</th><th>F</th><th>+/-</th><th>P</th>
          </tr>
        </thead>
        <tbody>
          {sortedTable.map((row, idx) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx < 2 ? '#f0fdf4' : 'transparent' }}>
              <td style={{ textAlign: 'left', padding: '8px 5px', fontWeight: 'bold' }}>{idx + 1}. {row.name}</td>
              <td>{row.played}</td>
              <td>{row.v}</td>
              <td>{row.o}</td>
              <td>{row.f}</td>
              <td style={{ color: row.goalDiff > 0 ? 'green' : row.goalDiff < 0 ? 'red' : 'black' }}>{row.goalDiff}</td>
              <td style={{ fontWeight: 'bold' }}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}