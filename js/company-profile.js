import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('company', '..', { allowIncompleteProfile: true })
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'profile.html', profile })

  const { data: company } = await supabase.from('companies').select('*').eq('profile_id', profile.id).single()

  if (!profile.profile_completed) {
    document.getElementById('setup-banner').style.display = 'block'
    document.getElementById('save-btn').textContent = 'Complete Profile'
  }

  document.getElementById('verify-badge').innerHTML = company?.is_verified
    ? '<span class="badge badge-success" style="margin-bottom:20px; display:inline-flex;">Verified Partner</span>'
    : '<div class="form-note">Not yet verified by a coordinator — job postings stay hidden from students until then.</div>'

  document.getElementById('company-name').value = company?.company_name || ''
  document.getElementById('industry').value = company?.industry || ''
  document.getElementById('address').value = company?.address || ''
  document.getElementById('website').value = company?.website || ''
  document.getElementById('contact-person').value = company?.contact_person || ''

  const saveBtn = document.getElementById('save-btn')
  const errorMsg = document.getElementById('error-msg')
  const successMsg = document.getElementById('success-msg')

  // --- Change tracking: Save stays disabled until something actually differs
  // from what's currently saved. ---
  function serializeForm() {
    return JSON.stringify({
      companyName: document.getElementById('company-name').value,
      industry: document.getElementById('industry').value,
      address: document.getElementById('address').value,
      website: document.getElementById('website').value,
      contactPerson: document.getElementById('contact-person').value,
    })
  }

  let originalSerialized = serializeForm()
  saveBtn.disabled = true

  function checkForChanges() {
    const changed = serializeForm() !== originalSerialized
    saveBtn.disabled = !changed
    if (changed) successMsg.style.display = 'none'
  }

  ;['company-name', 'industry', 'address', 'website', 'contact-person'].forEach((id) => {
    document.getElementById(id).addEventListener('input', checkForChanges)
  })

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'

    const industry = document.getElementById('industry').value.trim()
    const address = document.getElementById('address').value.trim()
    const contactPerson = document.getElementById('contact-person').value.trim()

    if (!profile.profile_completed) {
      const missing = []
      if (!industry) missing.push('industry')
      if (!address) missing.push('address')
      if (!contactPerson) missing.push('a contact person')
      if (missing.length) {
        errorMsg.textContent = `Please add ${missing.join(', ')} to complete your profile.`
        errorMsg.style.display = 'block'
        return
      }
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const willBeComplete = profile.profile_completed || (!!industry && !!address && !!contactPerson)

    const { error } = await supabase
      .from('companies')
      .update({
        company_name: document.getElementById('company-name').value,
        industry,
        address,
        website: document.getElementById('website').value,
        contact_person: contactPerson,
      })
      .eq('profile_id', profile.id)

    if (!error) {
      await supabase.from('profiles').update({ profile_completed: willBeComplete }).eq('id', profile.id)
    }

    saveBtn.textContent = profile.profile_completed ? 'Save Changes' : 'Complete Profile'

    if (error) {
      saveBtn.disabled = false
      errorMsg.textContent = error.message
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
