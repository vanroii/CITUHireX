// Loaded as an ES module directly in the browser — no bundler needed.
// Before pushing this publicly, consider moving these into a small
// server-rendered config or at least noting that the anon key is meant
// to be public (RLS policies are the real security boundary).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SUPABASE_URL = 'https://zbmltovcsigkpvhszfnp.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_u62cOpLIBj_OnedcsZ8xPg_HNJhO0NE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
