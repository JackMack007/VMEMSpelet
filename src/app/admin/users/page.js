'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UserAdmin() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      // 1. Hämta aktuell användare
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || authError) {
        router.push('/');
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
        router.push('/');
        return;
      }

      // 3. Om vi nått hit är användaren admin
      setIsAdmin(true);
      fetchUsers();
    };

    checkAdmin();
  }, [router]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (error) {
        console.error("Fel vid hämtning av användare:", error.message);
      } else {
        setProfiles(data || []);
      }
    } catch (err) {
      console.error("Oväntat fel:", err);
    } finally {
      setLoading(false);
    }
  }

  const unlockUserTips = async (targetUserId) => {
    if (!confirm("Vill du låsa upp tipsformuläret för denna användare?")) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ is_submitted: false })
      .eq('id', targetUserId);

    if (error) {
      alert("Kunde inte låsa upp: " + error.message);
    } else {
      fetchUsers();
    }
  }

  // Visa laddningsläge tills admin-status är bekräftad
  if (!isAdmin || loading) return <div style={{ padding: '50px' }}>Kontrollerar behörighet...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Användaradministration</h1>
          <Link href="/admin" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}>← Tillbaka till Adminpanelen</Link>
        </div>
      </header>

      <section style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {profiles.length === 0 ? (
          <p>Inga användare hittades i tabellen 'profiles'.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e0' }}>
                <th style={{ padding: '12px' }}>Namn/E-post</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Åtgärd</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>{p.full_name || p.id}</td>
                  <td style={{ padding: '12px' }}>
                    {p.is_submitted ? 
                      <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>✅ Inskickat (Låst)</span> : 
                      <span style={{ color: '#3182ce' }}>⏳ Öppen</span>
                    }
                  </td>
                  <td style={{ padding: '12px' }}>
                    {p.is_submitted && (
                      <button 
                        onClick={() => unlockUserTips(p.id)}
                        style={{ 
                          background: '#3182ce', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          padding: '6px 12px', 
                          cursor: 'pointer' 
                        }}
                      >
                        Lås upp tips
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      
      <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#64748b' }}>
        <p>Tips: Om en ny användare saknas, kontrollera att SQL-triggern i Supabase kördes korrekt vid registrering.</p>
      </div>
    </div>
  );
}