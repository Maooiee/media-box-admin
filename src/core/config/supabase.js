import { createClient } from '@supabase/supabase-js';

// Hardcoded — bypasses Netlify env vars entirely.
const supabaseUrl = 'https://qbefrttyhmhssdolbfhi.supabase.co';
const supabaseKey = 'sb_publishable_rNS9yqNHm0CcEF5iuud8Ig_chgMcior';

export const supabase = createClient(supabaseUrl, supabaseKey);