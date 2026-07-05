import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_KIND = { pending_approval: 'warn', open: 'success', closed: 'info', archived: 'info' }
const STATUS_LABEL = { pending_approval: 'Pending Approval', open: 'Open', closed: 'Closed', archived: 'Archived' }

const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'jobs.html', profile })

  const form = document.getElementById('new-job-form')
  const toggleBtn = document.getElementById('toggle-form-btn')
  const cancelBtn = document.getElementById('cancel-form-btn')

  toggleBtn.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? 'block' : 'none'
  })
  cancelBtn.addEventListener('click', () => {
    form.style.display = 'none'
    form.reset()
  })

  const { data: programs } = await supabase.from('programs').select('id, name').order('name')
  const programSelect = document.getElementById('eligible-programs')
  ;(programs || []).forEach((p) => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    programSelect.appendChild(opt)
  })

  async function loadJobs() {
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', profile.id)
      .order('created_at', { ascending: false })

    const list = document.getElementById('jobs-list')
    list.innerHTML = jobs && jobs.length
      ? jobs
          .map(
            (job) => `
        <div class="row-card">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.location}${job.is_remote ? ' (Remote)' : ''} · ${job.required_hours} hrs · ${job.slots_available} slot(s)</p>
          </div>
          <span class="badge badge-${STATUS_KIND[job.status] || 'info'}">${STATUS_LABEL[job.status] || job.status}</span>
        </div>`
          )
          .join('')
      : '<p class="empty-text">No postings yet — create your first one above.</p>'
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = document.getElementById('form-error')
    const submitBtn = document.getElementById('submit-job-btn')
    errorEl.style.display = 'none'
    submitBtn.disabled = true
    submitBtn.textContent = 'Submitting…'

    const selectedPrograms = [...programSelect.selectedOptions].map((o) => o.value)
    const skills = document
      .getElementById('required-skills')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const { error } = await supabase.from('job_postings').insert({
      company_id: profile.id,
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      location: document.getElementById('location').value,
      is_remote: document.getElementById('is-remote').checked,
      required_hours: Number(document.getElementById('required-hours').value),
      slots_available: Number(document.getElementById('slots').value),
      eligible_programs: selectedPrograms,
      required_skills: skills,
      status: 'pending_approval',
    })

    submitBtn.disabled = false
    submitBtn.textContent = 'Submit for Approval'

    if (error) {
      errorEl.textContent = error.message
      errorEl.style.display = 'block'
      return
    }

    form.reset()
    form.style.display = 'none'
    loadJobs()
  })

  loadJobs()
}
