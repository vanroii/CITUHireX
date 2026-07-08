import { supabase } from './supabase-client.js'

const verifyingPanel = document.getElementById('verifying-panel')
const invalidPanel = document.getElementById('invalid-panel')
const formPanel = document.getElementById('form-panel')
const donePanel = document.getElementById('done-panel')
const form = document.getElementById('reset-form')
const errorMsg = document.getElementById('error-msg')
const submitBtn = document.getElementById('submit-btn')

function showInvalid() {
  verifyingPanel.style.display = 'none'
  invalidPanel.style.display = 'block'
}

function showForm() {
  verifyingPanel.style.display = 'none'
  formPanel.style.display = 'block'
}

// Supabase's client parses the recovery token out of the URL (sent in the
// reset email) automatically and fires this event once it's verified —
// that's what proves "this really is the person who owns this email."
let resolved = false
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    resolved = true
    showForm()
  }
})

// Fallback in case the event already fired before this listener attached,
// or the link contains an already-valid session for some other reason.
supabase.auth.getSession().then(({ data }) => {
  if (!resolved && data.session) {
    resolved = true
    showForm()
  }
})

// If nothing verifies within a few seconds, the link is missing, expired, or malformed.
setTimeout(() => {
  if (!resolved) showInvalid()
}, 4000)

function showError(message) {
  errorMsg.textContent = message
  errorMsg.style.display = 'block'
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'

  const newPassword = document.getElementById('new-password').value
  const confirmPassword = document.getElementById('confirm-password').value

  if (newPassword !== confirmPassword) {
    showError('Passwords do not match.')
    return
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'Updating…'

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  submitBtn.disabled = false
  submitBtn.textContent = 'Update Password'

  if (error) {
    showError(error.message)
    return
  }

  formPanel.style.display = 'none'
  donePanel.style.display = 'block'
})
