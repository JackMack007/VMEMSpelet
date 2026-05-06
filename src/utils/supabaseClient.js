import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Vi lager en variabel utenfor funksjonen for å holde på klienten
let supabaseInstance;

export const supabase = (() => {
  // Hvis klienten ikke finnes ennå, lag den
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase-nøkler mangler i .env.local!");
    }
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  // Returner den eksisterende klienten
  return supabaseInstance;
})();