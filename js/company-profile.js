import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { INDUSTRIES } from '../js/industries.js'

// Companies are never gated behind profile completion — this is just a
// normal editable profile page.
const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'profile.html', profile })

  const { data: company } = await supabase.from('companies').select('*').eq('profile_id', profile.id).single()

  const verificationStatus = company?.verification_status || 'pending'
  const verifyBadgeHtml = {
    verified: '<span class="badge badge-success" style="margin-bottom:20px; display:inline-flex;">Verified Partner</span>',
    denied: '<div class="form-note" style="background:var(--warn-bg); border-color:rgba(184,134,11,0.3);">Your verification request was denied by a coordinator. Job postings stay hidden from students. Update your profile and contact your coordinator if you believe this was a mistake.</div>',
    terminated: '<div class="form-note" style="background:var(--warn-bg); border-color:rgba(184,134,11,0.3);">Your partnership with CITUHireX has been terminated by a coordinator. Job postings stay hidden from students. Contact your coordinator if you believe this was a mistake.</div>',
    pending: '<div class="form-note">Not yet verified by a coordinator — job postings stay hidden from students until then.</div>',
  }
  document.getElementById('verify-badge').innerHTML = verifyBadgeHtml[verificationStatus]

  const industrySelect = document.getElementById('industry')
  INDUSTRIES.forEach((name) => {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = name
    industrySelect.appendChild(opt)
  })

  document.getElementById('company-name').value = company?.company_name || ''
  document.getElementById('email').value = profile.email || ''
  industrySelect.value = company?.industry || ''
  document.getElementById('address').value = company?.address || ''
  document.getElementById('website').value = company?.website || ''
  document.getElementById('contact-person').value = company?.contact_person || ''

  const saveBtn = document.getElementById('save-btn')
  const errorMsg = document.getElementById('error-msg')
  const successMsg = document.getElementById('success-msg')

  function serializeForm() {
    return JSON.stringify({
      companyName: document.getElementById('company-name').value,
      industry: industrySelect.value,
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
    document.getElementById(id).addEventListener('change', checkForChanges)
  })

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const { error } = await supabase
      .from('companies')
      .update({
        company_name: document.getElementById('company-name').value,
        industry: industrySelect.value,
        address: document.getElementById('address').value,
        website: document.getElementById('website').value,
        contact_person: document.getElementById('contact-person').value,
      })
      .eq('profile_id', profile.id)

    saveBtn.textContent = 'Save Changes'

    if (error) {
      saveBtn.disabled = false
      errorMsg.textContent = error.message
      errorMsg.style.display = 'block'
      return
    }

    originalSerialized = serializeForm()
    saveBtn.disabled = true
    successMsg.style.display = 'block'
  })
}
