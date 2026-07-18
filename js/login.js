import { supabase } from './supabase-client.js'

let role = 'student'

const tabs = document.querySelectorAll('.role-tab')
const emailLabel = document.getElementById('email-label')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const submitBtn = document.getElementById('submit-btn')
const errorMsg = document.getElementById('error-msg')
const form = document.getElementById('login-form')
const forgotLink = document.getElementById('forgot-password-link')

// ---------- Show/Hide password toggle ----------
const passwordField = document.getElementById('password-field')
const togglePasswordBtn = document.getElementById('toggle-password')

togglePasswordBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password'
  passwordInput.type = isHidden ? 'text' : 'password'
  togglePasswordBtn.textContent = isHidden ? 'Hide' : 'Show'
})
passwordInput.addEventListener('input', () => {
  passwordField.classList.toggle('has-value', passwordInput.value.length > 0)
})

const ROLE_TITLE = { student: 'Student', company: 'Company', coordinator: 'Coordinator' }

function applyRoleUI() {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.role === role))
  emailLabel.textContent = role === 'student' ? 'School Email' : 'Email'
  emailInput.placeholder = role === 'student' ? 'yourname@cit.edu' : 'you@company.com'
  submitBtn.textContent = `Log In as ${ROLE_TITLE[role]}`
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    role = tab.dataset.role
    applyRoleUI()
  })
})

function showError(message) {
  errorMsg.textContent = message
  errorMsg.style.display = 'block'
}

function updateForgotLink() {
  const email = emailInput.value.trim()
  forgotLink.href = email ? `forgot-password.html?email=${encodeURIComponent(email)}` : 'forgot-password.html'
}
emailInput.addEventListener('input', updateForgotLink)

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'
  submitBtn.disabled = true
  submitBtn.textContent = 'Logging in…'

  const email = emailInput.value.trim()
  const password = passwordInput.value

  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    updateForgotLink()
    showError(`${signInError.message} — forgotten your password? Use the link below.`)
    submitBtn.disabled = false
    submitBtn.textContent = `Log In as ${ROLE_TITLE[role]}`
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, profile_completed')
    .eq('id', data.user.id)
    .single()

  submitBtn.disabled = false
  submitBtn.textContent = `Log In as ${ROLE_TITLE[role]}`

  if (profileError || !profile) {
    showError("Couldn't find a profile for this account.")
    return
  }

  if (profile.role !== role) {
    showError(`This account is registered as ${profile.role}, not ${role}.`)
    return
  }

  window.location.href = profile.profile_completed
    ? `${profile.role}/dashboard.html`
    : `${profile.role}/profile.html?setup=1`
})

const params = new URLSearchParams(window.location.search)
const prefillRole = params.get('role')
const prefillEmail = params.get('email')

if (['student', 'company', 'coordinator'].includes(prefillRole)) {
  role = prefillRole
}
if (prefillEmail) {
  emailInput.value = prefillEmail
}

let prefillPassword = null
try {
  prefillPassword = sessionStorage.getItem('citu_prefill_password')
  sessionStorage.removeItem('citu_prefill_password')
} catch {
  // sessionStorage unavailable — skip silently.
}
if (prefillPassword) {
  passwordInput.value = prefillPassword
  passwordField.classList.add('has-value')
}

applyRoleUI()
updateForgotLink()
