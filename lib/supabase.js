import { createClient } from '@supabase/supabase-js';

const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const url = `https://${projectId}.supabase.co`;

export const BUCKET = 'deal-files';

export function supabaseAdmin() {
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
