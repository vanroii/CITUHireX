import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { CEBU_LOCATIONS } from '../js/cebu-locations.js'

// Profile page must load even when profile_completed is false — this IS
// where that gets fixed, so it opts out of the redirect-to-profile check.
const auth = await requireRole('student', '..', { allowIncompleteProfile: true })
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'profile.html', profile })

  const { data: student } = await supabase
    .from('students')
    .select('*, programs(id, name)')
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

  // ---------- Preferred location: City -> Barangay cascade, same data as signup ----------
  const citySelect = document.getElementById('preferred-city')
  const barangaySelect = document.getElementById('preferred-barangay')

  Object.keys(CEBU_LOCATIONS).forEach((city) => {
    const opt = document.createElement('option')
    opt.value = city
    opt.textContent = city
    citySelect.appendChild(opt)
  })

  function populateBarangays(city, preselect) {
    barangaySelect.innerHTML = ''
    if (!city) {
      barangaySelect.disabled = true
      barangaySelect.innerHTML = '<option value="">Select city/municipality first</option>'
      return
    }
    barangaySelect.disabled = false
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = 'Select barangay'
    barangaySelect.appendChild(placeholder)
    CEBU_LOCATIONS[city].forEach((brgy) => {
      const opt = document.createElement('option')
      opt.value = brgy
      opt.textContent = brgy
      if (brgy === preselect) opt.selected = true
      barangaySelect.appendChild(opt)
    })
  }

  // Best-effort parse of an existing free-text "Barangay, City" value from
  // before this UI existed. If it doesn't match cleanly, both selects just
  // start blank rather than showing something wrong.
  const existingLocation = student?.preferred_location || ''
  let matchedCity = ''
  let matchedBarangay = ''
  for (const city of Object.keys(CEBU_LOCATIONS)) {
    if (existingLocation.includes(city)) {
      matchedCity = city
      const found = CEBU_LOCATIONS[city].find((b) => existingLocation.includes(b))
      if (found) matchedBarangay = found
      break
    }
  }
  citySelect.value = matchedCity
  populateBarangays(matchedCity, matchedBarangay)

  citySelect.addEventListener('change', () => populateBarangays(citySelect.value, null))

  // ---------- Skills: scoped to the student's own program ----------
  const skillsContainer = document.getElementById('skills')
  let programSkills = []

  if (student?.programs?.id) {
    const { data: mappings } = await supabase
      .from('program_skills')
      .select('skills(name)')
      .eq('program_id', student.programs.id)
    programSkills = (mappings || []).map((m) => m.skills.name).sort()
  }

  const checkedSkills = student?.skills || []
  skillsContainer.innerHTML = programSkills.length
    ? programSkills
        .map(
          (name) => `
      <label>
        <input type="checkbox" class="skill-checkbox" value="${name.replace(/"/g, '&quot;')}" ${checkedSkills.includes(name) ? 'checked' : ''} />
        <span>${name}</span>
      </label>`
        )
        .join('')
    : '<p class="sub-meta">No standardized skills found for your program yet.</p>'

  function selectedSkills() {
    return [...skillsContainer.querySelectorAll('.skill-checkbox:checked')].map((cb) => cb.value)
  }

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
      city: citySelect.value,
      barangay: barangaySelect.value,
      skills: selectedSkills().sort(),
    })
  }

  let originalSerialized = serializeForm()
  saveBtn.disabled = true

  function checkForChanges() {
    const changed = serializeForm() !== originalSerialized
    saveBtn.disabled = !changed
    if (changed) successMsg.style.display = 'none'
  }

  ;['full-name', 'phone', 'year-level', 'preferred-city', 'preferred-barangay'].forEach((id) => {
    document.getElementById(id).addEventListener('input', checkForChanges)
    document.getElementById(id).addEventListener('change', checkForChanges)
  })
  skillsContainer.querySelectorAll('.skill-checkbox').forEach((cb) => cb.addEventListener('change', checkForChanges))

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'

    const skills = selectedSkills()
    const preferredLocation = [barangaySelect.value, citySelect.value].filter(Boolean).join(', ')

    if (!profile.profile_completed) {
      const missing = []
      if (skills.length === 0) missing.push('at least one skill')
      if (!citySelect.value || !barangaySelect.value) missing.push('a preferred city and barangay')
      if (missing.length) {
        errorMsg.textContent = `Please add ${missing.join(', ')} to complete your profile.`
        errorMsg.style.display = 'block'
        return
      }
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const willBeComplete = profile.profile_completed || (skills.length > 0 && !!citySelect.value && !!barangaySelect.value)

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

    originalSerialized = serializeForm()
    saveBtn.disabled = true
    successMsg.style.display = 'block'
  })
}
