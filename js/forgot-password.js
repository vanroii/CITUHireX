import { supabase } from './supabase-client.js'

const form = document.getElementById('reset-request-form')
const emailInput = document.getElementById('email')
const errorMsg = document.getElementById('error-msg')
const submitBtn = document.getElementById('submit-btn')
const requestPanel = document.getElementById('request-panel')
const sentPanel = document.getElementById('sent-panel')

// Pre-fill from ?email= if arriving from the login page's "Forgot password?" link.
const params = new URLSearchParams(window.location.search)
const prefillEmail = params.get('email')
if (prefillEmail) emailInput.value = prefillEmail

function showError(message) {
  errorMsg.textContent = message
  errorMsg.style.display = 'block'
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'
  submitBtn.disabled = true
  submitBtn.textContent = 'Sending…'

  const email = emailInput.value.trim()

  // Supabase requires this exact URL to already be registered under
  // Authentication -> URL Configuration -> Redirect URLs in the dashboard,
  // otherwise the reset email link will fail to redirect correctly.
  const redirectTo = new URL('reset-password.html', window.location.href).href

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  submitBtn.disabled = false
  submitBtn.textContent = 'Send Reset Link'

  if (error) {
    showError(error.message)
    return
  }

  document.getElementById('sent-email').textContent = email
  requestPanel.style.display = 'none'
  sentPanel.style.display = 'block'
})
