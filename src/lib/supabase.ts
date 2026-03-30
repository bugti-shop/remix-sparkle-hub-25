import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://polputoxbnclumxhvnjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbHB1dG94Ym5jbHVteGh2bmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTg4MzgsImV4cCI6MjA4OTk5NDgzOH0.77HXaoLZoeFZ37SRocUD4STxm7_lUtaA1H_eNCyh558';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
