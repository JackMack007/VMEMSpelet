import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'teams'; 
  const apiKey = process.env.NEXT_PUBLIC_WC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API-nyckel saknas i .env.local" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.wc2026api.com/${type}`, {
      method: 'GET',
      headers: { 
        // ALTERNATIV A: Standard för Authorization header
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 } 
    });

    if (!res.ok) {
      // Om det fortfarande blir 401 med Bearer, kan vi prova Alternativ B (bara nyckeln)
      // Men vi börjar med att logga vad som händer:
      console.error(`API Svarade med status ${res.status}`);
      return NextResponse.json({ error: `API-fel: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: "Kunde inte ansluta till API" }, { status: 500 });
  }
}