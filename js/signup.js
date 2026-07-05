import { supabase } from './supabase-client.js'

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

  submitBtn.disabled = true
  submitBtn.textContent = 'Creating account…'

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
          industry: document.getElementById('industry').value.trim(),
          address: document.getElementById('address').value.trim(),
          contact_person: document.getElementById('contact-person').value.trim(),
        }

  // profiles (+ the matching students/companies row) are created automatically
  // by a database trigger reading this metadata — see
  // supabase/migrations/0008_handle_new_user_trigger.sql
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
    window.location.href = `${role}/dashboard.html`
    return
  }

  document.getElementById('sent-email').textContent = email
  form.style.display = 'none'
  loginLinkRow.style.display = 'none'
  successPanel.style.display = 'block'
})

setRole('student')
