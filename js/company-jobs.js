import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_KIND = { pending_approval: 'warn', open: 'success', closed: 'info', archived: 'info' }
const STATUS_LABEL = { pending_approval: 'Pending Approval', open: 'Open', closed: 'Closed', archived: 'Archived' }
const DEFAULT_REQUIRED_HOURS = 600

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
  const allPrograms = programs || []
  const programSelect = document.getElementById('eligible-programs')
  allPrograms.forEach((p) => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    programSelect.appendChild(opt)
  })

  let jobs = []
  let expandedJobId = null
  const applicantCounts = {} // cached per job id once fetched

  async function loadJobs() {
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .eq('company_id', profile.id)
      .order('created_at', { ascending: false })
    jobs = data || []
    render()
  }

  function programNames(idList) {
    if (!idList || idList.length === 0) return 'Open to all CEA'
    return idList.map((id) => allPrograms.find((p) => p.id === id)?.name || 'Unknown').join(', ')
  }

  function programOptionsHtml(selectedIds, selectId) {
    return `<select id="${selectId}" multiple size="6">
      ${allPrograms.map((p) => `<option value="${p.id}" ${selectedIds?.includes(p.id) ? 'selected' : ''}>${p.name}</option>`).join('')}
    </select>`
  }

  function render() {
    const list = document.getElementById('jobs-list')
    list.innerHTML = jobs.length
      ? jobs.map((job) => renderCard(job)).join('')
      : '<p class="empty-text">No postings yet — create your first one above.</p>'

    document.querySelectorAll('.job-post-header').forEach((header) => {
      header.addEventListener('click', () => {
        const id = header.closest('.job-post-card').dataset.jobId
        expandedJobId = expandedJobId === id ? null : id
        render()
        if (expandedJobId === id) loadApplicantCount(id)
      })
    })

    document.querySelectorAll('.job-post-details').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation())
    })

    document.querySelectorAll('.save-job-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        saveJobEdit(btn.dataset.jobId, btn)
      })
    })

    document.querySelectorAll('.delete-job-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        deleteJob(btn.dataset.jobId, btn)
      })
    })
  }

  async function loadApplicantCount(jobId) {
    if (applicantCounts[jobId] !== undefined) return
    const { count } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('job_posting_id', jobId)
    applicantCounts[jobId] = count || 0
    const el = document.getElementById(`applicant-count-${jobId}`)
    if (el) el.textContent = `${applicantCounts[jobId]} applicant${applicantCounts[jobId] === 1 ? '' : 's'} so far`
  }

  function renderCard(job) {
    const expanded = expandedJobId === job.id
    return `
      <div class="row-card job-post-card" style="flex-direction:column; align-items:stretch;" data-job-id="${job.id}">
        <div class="job-post-header" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.location} · ${job.slots_available} slot(s)</p>
            <p class="sub-meta">${programNames(job.eligible_programs)}</p>
          </div>
          <div class="row-actions">
            <span class="badge badge-${STATUS_KIND[job.status] || 'info'}">${STATUS_LABEL[job.status] || job.status}</span>
            <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide details ▲' : 'View / Edit ▼'}</span>
          </div>
        </div>
        ${expanded ? renderEditForm(job) : ''}
      </div>`
  }

  function renderEditForm(job) {
    return `
    <div class="job-post-details" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
      <p class="sub-meta" id="applicant-count-${job.id}" style="margin-bottom:16px;">Loading applicant count…</p>

      <div class="field">
        <label>Title</label>
        <input type="text" class="edit-title" value="${job.title.replace(/"/g, '&quot;')}" />
      </div>
      <div class="field">
        <label>Description</label>
        <textarea class="edit-description" rows="4">${job.description || ''}</textarea>
      </div>
      <div class="field">
        <label>Location</label>
        <input type="text" class="edit-location" value="${(job.location || '').replace(/"/g, '&quot;')}" />
      </div>
      <div class="field">
        <label>Slots Available</label>
        <input type="number" class="edit-slots" value="${job.slots_available}" min="0" />
      </div>
      <div class="field">
        <label>Eligible Programs</label>
        ${programOptionsHtml(job.eligible_programs, `edit-programs-${job.id}`)}
      </div>
      <div class="field">
        <label>Required Skills (comma-separated)</label>
        <input type="text" class="edit-skills" value="${(job.required_skills || []).join(', ')}" />
      </div>

      <p class="form-error edit-job-error" style="display:none;"></p>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-primary btn-sm save-job-btn" data-job-id="${job.id}">Save Changes</button>
        <button class="btn btn-ghost btn-sm delete-job-btn" data-job-id="${job.id}">Delete Posting</button>
      </div>
    </div>`
  }

  async function saveJobEdit(jobId, btn) {
    const card = btn.closest('.job-post-card')
    const errorEl = card.querySelector('.edit-job-error')
    errorEl.style.display = 'none'
    btn.disabled = true
    btn.textContent = 'Saving…'

    const programSel = card.querySelector(`#edit-programs-${jobId}`)
    const selectedPrograms = [...programSel.selectedOptions].map((o) => o.value)
    const skills = card
      .querySelector('.edit-skills')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const { error } = await supabase
      .from('job_postings')
      .update({
        title: card.querySelector('.edit-title').value,
        description: card.querySelector('.edit-description').value,
        location: card.querySelector('.edit-location').value,
        slots_available: Number(card.querySelector('.edit-slots').value),
        eligible_programs: selectedPrograms,
        required_skills: skills,
      })
      .eq('id', jobId)

    btn.disabled = false
    btn.textContent = 'Save Changes'

    if (error) {
      errorEl.textContent = error.message
      errorEl.style.display = 'block'
      return
    }

    await loadJobs()
    expandedJobId = jobId
    render()
  }

  async function deleteJob(jobId, btn) {
    const count = applicantCounts[jobId] ?? 0
    const warning =
      count > 0
        ? `This posting has ${count} applicant${count === 1 ? '' : 's'}. Deleting it will also permanently delete their application record${count === 1 ? '' : 's'}. This cannot be undone.`
        : 'Delete this job posting? This cannot be undone.'

    if (!confirm(warning)) return

    btn.disabled = true
    btn.textContent = 'Deleting…'

    const { error } = await supabase.from('job_postings').delete().eq('id', jobId)
    if (error) {
      btn.disabled = false
      btn.textContent = 'Delete Posting'
      alert(error.message)
      return
    }

    expandedJobId = null
    await loadJobs()
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
      is_remote: false,
      required_hours: DEFAULT_REQUIRED_HOURS,
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
