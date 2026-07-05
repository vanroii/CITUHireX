import { supabase } from './supabase-client.js'

let role = 'student'

const tabs = document.querySelectorAll('.role-tab')
const emailLabel = document.getElementById('email-label')
const emailInput = document.getElementById('email')
const submitBtn = document.getElementById('submit-btn')
const errorMsg = document.getElementById('error-msg')
const form = document.getElementById('login-form')

const ROLE_TITLE = { student: 'Student', company: 'Company', coordinator: 'Coordinator' }

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    role = tab.dataset.role
    emailLabel.textContent = role === 'student' ? 'School Email' : 'Email'
    emailInput.placeholder = role === 'student' ? 'yourname@cit.edu' : 'you@company.com'
    submitBtn.textContent = `Log In as ${ROLE_TITLE[role]}`
  })
})

function showError(message) {
  errorMsg.textContent = message
  errorMsg.style.display = 'block'
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'
  submitBtn.disabled = true
  submitBtn.textContent = 'Logging in…'

  const email = emailInput.value.trim()
  const password = document.getElementById('password').value

  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    showError(signInError.message)
    submitBtn.disabled = false
    submitBtn.textContent = `Log In as ${ROLE_TITLE[role]}`
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
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

  window.location.href = `${profile.role}/dashboard.html`
})
