import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'profile.html', profile })

  const { data: student } = await supabase
    .from('students')
    .select('*, programs(name)')
    .eq('profile_id', profile.id)
    .single()

  document.getElementById('full-name').value = profile.full_name || ''
  document.getElementById('student-number').value = student?.student_number || ''
  document.getElementById('program-name').value = student?.programs?.name || ''
  document.getElementById('year-level').value = String(student?.year_level || 1)
  document.getElementById('phone').value = profile.phone || ''
  document.getElementById('preferred-location').value = student?.preferred_location || ''
  document.getElementById('skills').value = (student?.skills || []).join(', ')

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const saveBtn = document.getElementById('save-btn')
    const errorMsg = document.getElementById('error-msg')
    const successMsg = document.getElementById('success-msg')
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const skills = document
      .getElementById('skills')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const [{ error: profileErr }, { error: studentErr }] = await Promise.all([
      supabase
        .from('profiles')
        .update({ full_name: document.getElementById('full-name').value, phone: document.getElementById('phone').value })
        .eq('id', profile.id),
      supabase
        .from('students')
        .update({
          year_level: Number(document.getElementById('year-level').value),
          preferred_location: document.getElementById('preferred-location').value,
          skills,
        })
        .eq('profile_id', profile.id),
    ])

    saveBtn.disabled = false
    saveBtn.textContent = 'Save Changes'

    if (profileErr || studentErr) {
      errorMsg.textContent = (profileErr || studentErr).message
      errorMsg.style.display = 'block'
      return
    }

    successMsg.style.display = 'block'
  })
}
