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
 * Redirects to /login.html if signed out, to the correct role's dashboard
 * if signed in as the wrong role, or to that role's profile.html if their
 * profile isn't finished yet (unless this IS the profile page — pass
 * { allowIncompleteProfile: true } there so it doesn't redirect to itself).
 * Resolves with { session, profile } on success so the page can render.
 */
export async function requireRole(expectedRole, rootPrefix = '..', options = {}) {
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
  if (!profile.profile_completed && !options.allowIncompleteProfile) {
    window.location.href = `${rootPrefix}/${profile.role}/profile.html?setup=1`
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
 * Also enforces the profile-completion gate.
 */
export async function requireAuth(rootPrefix = '..') {
  const { session, profile } = await getCurrentUser()
  if (!session || !profile) {
    window.location.href = `${rootPrefix}/login.html`
    return null
  }
  if (!profile.profile_completed) {
    window.location.href = `${rootPrefix}/${profile.role}/profile.html?setup=1`
    return null
  }
  return { session, profile }
}
