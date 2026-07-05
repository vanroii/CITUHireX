import { supabase } from './supabase-client.js'

/**
 * Resolves the current session + profile row.
 * Returns { session: null, profile: null } if signed out.
 */
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { session: null, profile: null }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return { session, profile: error ? null : profile }
}

/**
 * Call at the top of every protected dashboard page.
 * Redirects to /login.html if signed out, or to the correct role's
 * dashboard if signed in as the wrong role. Resolves with { session, profile }
 * on success so the page can continue rendering.
 */
export async function requireRole(expectedRole, rootPrefix = '..') {
  const { session, profile } = await getCurrentUser()

  if (!session) {
    window.location.href = `${rootPrefix}/login.html`
    return null
  }
  if (!profile) {
    window.location.href = `${rootPrefix}/login.html`
    return null
  }
  if (profile.role !== expectedRole) {
    window.location.href = `${rootPrefix}/${profile.role}/dashboard.html`
    return null
  }

  return { session, profile }
}

export async function signOut(rootPrefix = '..') {
  await supabase.auth.signOut()
  window.location.href = `${rootPrefix}/login.html`
}

/**
 * Like requireRole, but accepts any signed-in profile regardless of role.
 * Used by pages (like Messages) shared across all three role folders.
 */
export async function requireAuth(rootPrefix = '..') {
  const { session, profile } = await getCurrentUser()
  if (!session || !profile) {
    window.location.href = `${rootPrefix}/login.html`
    return null
  }
  return { session, profile }
}
