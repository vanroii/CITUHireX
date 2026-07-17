import { supabase } from './supabase-client.js'
import { CEBU_LOCATIONS } from './cebu-locations.js'
import { INDUSTRIES } from './industries.js'

let role = 'student'

const tabs = document.querySelectorAll('.role-tab')
const emailLabel = document.getElementById('email-label')
const emailInput = document.getElementById('email')
const studentFields = document.getElementById('student-fields')
const companyFields = document.getElementById('company-fields')
const coordinatorNotice = document.getElementById('coordinator-notice')
const form = document.getElementById('signup-form')
const loginLinkRow = document.getElementById('login-link-row')
const errorMsg = document.getElementById('error-msg')
const submitBtn = document.getElementById('submit-btn')
const brandHeading = document.getElementById('brand-heading')
const brandCopy = document.getElementById('brand-copy')
const successPanel = document.getElementById('success-panel')
const citySelect = document.getElementById('city')
const barangaySelect = document.getElementById('barangay')

const BRAND = {
  student: {
    heading: 'Create your<br />student account',
    copy: 'Browse verified OJT postings, track applications, and log your required hours in one place.',
  },
  company: {
    heading: 'Create your<br />company account',
    copy: "Post OJT openings and manage applicants. Your account will need coordinator verification before postings go live.",
  },
  coordinator: {
    heading: 'Create your<br />coordinator account',
    copy: 'Coordinator accounts oversee approvals and endorsements. New coordinator access is provisioned manually rather than through self-signup.',
  },
}

function setRole(newRole) {
  role = newRole
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.role === role))
  brandHeading.innerHTML = BRAND[role].heading
  brandCopy.textContent = BRAND[role].copy

  studentFields.style.display = role === 'student' ? 'block' : 'none'
  companyFields.style.display = role === 'company' ? 'block' : 'none'
  coordinatorNotice.style.display = role === 'coordinator' ? 'block' : 'none'
  form.style.display = role === 'coordinator' ? 'none' : 'block'
  loginLinkRow.style.display = role === 'coordinator' ? 'none' : 'block'

  emailLabel.textContent = role === 'student' ? 'School Email' : 'Email'
  emailInput.placeholder = role === 'student' ? 'yourname@cit.edu' : 'you@company.com'
}

tabs.forEach((tab) => tab.addEventListener('click', () => setRole(tab.dataset.role)))

// Populate the program dropdown from the live programs table.
supabase
  .from('programs')
  .select('id, name')
  .order('name')
  .then(({ data }) => {
    const select = document.getElementById('program-id')
    ;(data || []).forEach((p) => {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = p.name
      select.appendChild(opt)
    })
  })

// Populate the standardized industry dropdown.
INDUSTRIES.forEach((name) => {
  const opt = document.createElement('option')
  opt.value = name
  opt.textContent = name
  document.getElementById('industry').appendChild(opt)
})

// Populate City/Municipality, then cascade Barangay options on selection.
Object.keys(CEBU_LOCATIONS).forEach((city) => {
  const opt = document.createElement('option')
  opt.value = city
  opt.textContent = city
  citySelect.appendChild(opt)
})

citySelect.addEventListener('change', () => {
  const city = citySelect.value
  barangaySelect.innerHTML = ''

  if (!city) {
    barangaySelect.disabled = true
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = 'Select city/municipality first'
    barangaySelect.appendChild(opt)
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
    barangaySelect.appendChild(opt)
  })
})

function showError(message) {
  errorMsg.textContent = message
  errorMsg.style.display = 'block'
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorMsg.style.display = 'none'

  const fullName = document.getElementById('full-name').value.trim()
  const email = emailInput.value.trim()
  const password = document.getElementById('password').value
  const programId = document.getElementById('program-id')?.value

  if (role === 'student' && !/@cit\.edu$/i.test(email)) {
    showError('Student accounts must use a cit.edu email address.')
    return
  }
  if (role === 'student' && !programId) {
    showError('Please select your program.')
    return
  }
  if (role === 'company') {
    if (!citySelect.value || !barangaySelect.value) {
      showError('Please select your company\'s city/municipality and barangay.')
      return
    }
    if (!document.getElementById('industry').value) {
      showError('Please select an industry.')
      return
    }
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'Creating account…'

  const street = document.getElementById('street')?.value.trim()
  const address = [street, barangaySelect.value, citySelect.value].filter(Boolean).join(', ')

  const metadata =
    role === 'student'
      ? {
          role,
          full_name: fullName,
          student_number: document.getElementById('student-number').value.trim(),
          program_id: programId,
          year_level: document.getElementById('year-level').value,
        }
      : {
          role,
          full_name: fullName,
          company_name: document.getElementById('company-name').value.trim(),
          industry: document.getElementById('industry').value,
          address,
          contact_person: document.getElementById('contact-person').value.trim(),
        }

  // profiles (+ the matching students/companies row) are created automatically
  // by a database trigger reading this metadata — see
  // supabase/migrations/0008_handle_new_user_trigger.sql and
  // supabase/migrations/0019_student_only_profile_gate.sql
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })

  submitBtn.disabled = false
  submitBtn.textContent = 'Create Account'

  if (signUpError) {
    showError(signUpError.message)
    return
  }

  if (data.session) {
    // Only students have a profile-completion gate — companies go straight to their dashboard.
    window.location.href = role === 'student' ? `${role}/profile.html?setup=1` : `${role}/dashboard.html`
    return
  }

  // Email confirmation required: hand the role + email + password to the
  // login page so the person only has to click "Log In" once they've
  // confirmed their address. Password only ever goes in sessionStorage
  // (cleared the moment login.js reads it), never in the URL — if the
  // confirmation link happens to open in a different tab, sessionStorage
  // won't carry over and the password field just comes up empty, which is
  // a safe, graceful fallback rather than a broken page.
  try {
    sessionStorage.setItem('citu_prefill_password', password)
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — not fatal.
  }

  document.getElementById('sent-email').textContent = email
  form.style.display = 'none'
  loginLinkRow.style.display = 'none'
  successPanel.style.display = 'block'

  const goToLoginBtn = document.getElementById('go-to-login-btn')
  if (goToLoginBtn) {
    goToLoginBtn.href = `login.html?role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`
  }
})

// Preselect the role tab from a query param, e.g. signup.html?role=company
const params = new URLSearchParams(window.location.search)
const initialRole = params.get('role')
setRole(['student', 'company', 'coordinator'].includes(initialRole) ? initialRole : 'student')
