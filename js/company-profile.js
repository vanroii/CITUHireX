import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'profile.html', profile })

  const { data: company } = await supabase.from('companies').select('*').eq('profile_id', profile.id).single()

  document.getElementById('verify-badge').innerHTML = company?.is_verified
    ? '<span class="badge badge-success" style="margin-bottom:20px; display:inline-flex;">Verified Partner</span>'
    : '<div class="form-note">Not yet verified by a coordinator — job postings stay hidden from students until then.</div>'

  document.getElementById('company-name').value = company?.company_name || ''
  document.getElementById('industry').value = company?.industry || ''
  document.getElementById('address').value = company?.address || ''
  document.getElementById('website').value = company?.website || ''
  document.getElementById('contact-person').value = company?.contact_person || ''

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const saveBtn = document.getElementById('save-btn')
    const errorMsg = document.getElementById('error-msg')
    const successMsg = document.getElementById('success-msg')
    errorMsg.style.display = 'none'
    successMsg.style.display = 'none'
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    const { error } = await supabase
      .from('companies')
      .update({
        company_name: document.getElementById('company-name').value,
        industry: document.getElementById('industry').value,
        address: document.getElementById('address').value,
        website: document.getElementById('website').value,
        contact_person: document.getElementById('contact-person').value,
      })
      .eq('profile_id', profile.id)

    saveBtn.disabled = false
    saveBtn.textContent = 'Save Changes'

    if (error) {
      errorMsg.textContent = error.message
      errorMsg.style.display = 'block'
      return
    }
    successMsg.style.display = 'block'
  })
}
