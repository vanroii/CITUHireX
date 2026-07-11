import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

// Profile page must load even when profile_completed is false — this IS
// where that gets fixed, so it opts out of the redirect-to-profile check.
const auth = await requireRole('student', '..', { allowIncompleteProfile: true })
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'profile.html', profile })

  const { data: student } = await supabase
    .from('students')
    .select('*, programs(name)')
    .eq('profile_id', profile.id)
    .single()

  if (!profile.profile_completed) {
    document.getElementById('setup-banner').style.display = 'block'
    document.getElementById('save-btn').textContent = 'Complete Profile'
  }

  document.getElementById('full-name').value = profile.full_name || ''
  document.getElementById('student-number').value = student?.student_number || ''
  document.getElementById('program-name').value = student?.programs?.name || ''
  document.getElementById('year-level').value = String(student?.year_level || 1)
  document.getElementById('phone').value = profile.phone || ''
  document.getElementById('preferred-location').value = student?.preferred_location || ''
  document.getElementById('skills').value = (student?.skills || []).join(', ')

  const saveBtn = document.getElementById('save-btn')
  const errorMsg = document.getElementById('error-msg')
  const successMsg = document.getElementById('success-msg')

  // --- Change tracking: Save stays disabled until something actually differs
  // from what's currently saved. ---
  function serializeForm() {
    return JSON.stringify({
      fullName: document.getElementById('full-name').value,
      phone: document.getElementById('phone').value,
      yearLevel: document.getElementById('year-level').value,
      preferredLocation: document.getElementById('preferred-location').value,
      skills: document.getElementById('skills').value,
    })
  }

  let originalSerialized = serializeForm()
  saveBtn.disabled = true

  function checkForChanges() {
    const changed = serializeForm() !== originalSerialized
    saveBtn.disabled = !changed
    if (changed) successMsg.style.display = 'none'
  }

  ;['full-name', 'phone', 'year-level', 'preferred-location', 'skills'].forEach((id) => {
    document.getElementById(id).addEventListener('input', checkForChanges)
    document.getElementById(id).addEventListener('change', checkForChanges)
  })

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'

    const skills = document
      .getElementById('skills')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const preferredLocation = document.getElementById('preferred-location').value.trim()

    // Required to unlock the rest of the site: at least one skill and a
    // preferred location — these drive job matching (Browse Jobs -> Matched
    // Jobs). Resume is attached per-application on Browse Jobs, not here.
    if (!profile.profile_completed) {
      const missing = []
      if (skills.length === 0) missing.push('at least one skill')
      if (!preferredLocation) missing.push('a preferred location')
      if (missing.length) {
        errorMsg.textContent = `Please add ${missing.join(', ')} to complete your profile.`
        errorMsg.style.display = 'block'
        return
      }
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const willBeComplete = profile.profile_completed || (skills.length > 0 && !!preferredLocation)

    const [{ error: profileErr }, { error: studentErr }] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: document.getElementById('full-name').value,
          phone: document.getElementById('phone').value,
          profile_completed: willBeComplete,
        })
        .eq('id', profile.id),
      supabase
        .from('students')
        .update({
          year_level: Number(document.getElementById('year-level').value),
          preferred_location: preferredLocation,
          skills,
        })
        .eq('profile_id', profile.id),
    ])

    saveBtn.textContent = profile.profile_completed ? 'Save Changes' : 'Complete Profile'

    if (profileErr || studentErr) {
      saveBtn.disabled = false
      errorMsg.textContent = (profileErr || studentErr).message
      errorMsg.style.display = 'block'
      return
    }

    if (!profile.profile_completed && willBeComplete) {
      window.location.href = 'dashboard.html'
      return
    }

    // Saved successfully: this is the new baseline, so Save goes disabled
    // again until the next actual change.
    originalSerialized = serializeForm()
    saveBtn.disabled = true
    successMsg.style.display = 'block'
  })
}
