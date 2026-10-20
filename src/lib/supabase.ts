import { createClient } from '@supabase/supabase-js';

// We explicitly fallback to your actual project URL and Anon Key to prevent Next.js caching issues.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://letangcabkdqhhjqbdyj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldGFuZ2NhYmtkcWhoanFiZHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzk5MDQsImV4cCI6MjEwNTY1NTkwNH0.EwebCq_p8lPanvHbskSKOwyzi1b8EDMisft_fFFINcE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getSession() {
  return { user: null };
}
