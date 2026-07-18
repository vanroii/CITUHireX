import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_KIND = { pending_approval: 'warn', open: 'success', closed: 'info', archived: 'info', declined: 'warn' }
const STATUS_LABEL = { pending_approval: 'Pending Approval', open: 'Open', closed: 'Closed', archived: 'Archived', declined: 'Declined' }
const DEFAULT_REQUIRED_HOURS = 600

const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'jobs.html', profile })

  const form = document.getElementById('new-job-form')
  const toggleBtn = document.getElementById('toggle-form-btn')
  const cancelBtn = document.getElementById('cancel-form-btn')
  const locationDisplay = document.getElementById('location-display')

  const { data: company } = await supabase.from('companies').select('address').eq('profile_id', profile.id).single()
  const companyAddress = company?.address || ''
  locationDisplay.textContent = companyAddress || 'No address on file yet — set one on your Company Profile first.'

  function openForm() {
    form.style.display = 'block'
    toggleBtn.style.display = 'none'
  }
  function closeForm() {
    form.style.display = 'none'
    toggleBtn.style.display = 'inline-flex'
  }

  toggleBtn.addEventListener('click', openForm)
  cancelBtn.addEventListener('click', () => {
    closeForm()
    form.reset()
  })

  const { data: programs } = await supabase.from('programs').select('id, code, name').order('name')
  const allPrograms = programs || []

  const { data: mappings } = await supabase
    .from('program_skills')
    .select('program_id, programs(code), skills(id, name)')

  const skillById = new Map()
  ;(mappings || []).forEach((m) => {
    if (!skillById.has(m.skills.id)) {
      skillById.set(m.skills.id, { id: m.skills.id, name: m.skills.name, programCodes: new Set() })
    }
    skillById.get(m.skills.id).programCodes.add(m.programs.code)
  })
  const allSkills = [...skillById.values()].sort((a, b) => a.name.localeCompare(b.name))
  const programIdToCode = new Map(allPrograms.map((p) => [p.id, p.code]))

  function availableSkills(selectedProgramIds) {
    if (selectedProgramIds.length === 0) return allSkills
    const selectedCodes = new Set(selectedProgramIds.map((id) => programIdToCode.get(id)))
    return allSkills.filter((s) => [...s.programCodes].some((c) => selectedCodes.has(c)))
  }

  function renderSkillCheckboxes(container, skills, checkedNames) {
    container.innerHTML = skills.length
      ? skills
          .map(
            (s) => `
      <label>
        <input type="checkbox" class="skill-checkbox" value="${s.name.replace(/"/g, '&quot;')}" ${checkedNames?.includes(s.name) ? 'checked' : ''} />
        <span>${s.name}<span class="skill-program-tag">(${[...s.programCodes].join(', ')})</span></span>
      </label>`
          )
          .join('')
      : '<p class="sub-meta">No standardized skills for this selection yet.</p>'
  }

  function selectedSkillNames(container) {
    return [...container.querySelectorAll('.skill-checkbox:checked')].map((cb) => cb.value)
  }

  function buildProgramCheckboxes(container, selectedIds, groupName, onChange) {
    container.innerHTML = allPrograms
      .map(
        (p) => `
      <label>
        <input type="checkbox" class="program-checkbox" name="${groupName}" value="${p.id}" ${selectedIds?.includes(p.id) ? 'checked' : ''} />
        <span>${p.name}</span>
      </label>`
      )
      .join('')
    if (onChange) {
      container.querySelectorAll('.program-checkbox').forEach((cb) => cb.addEventListener('change', onChange))
    }
  }

  function selectedProgramIds(container) {
    return [...container.querySelectorAll('.program-checkbox:checked')].map((cb) => cb.value)
  }

  const createProgramsEl = document.getElementById('eligible-programs')
  const createSkillsEl = document.getElementById('required-skills')

  function refreshCreateSkills() {
    const previouslyChecked = selectedSkillNames(createSkillsEl)
    renderSkillCheckboxes(createSkillsEl, availableSkills(selectedProgramIds(createProgramsEl)), previouslyChecked)
  }

  buildProgramCheckboxes(createProgramsEl, [], 'new-job-programs', refreshCreateSkills)
  refreshCreateSkills()

  let jobs = []
  let expandedJobId = null
  const applicantCounts = {}

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
      })
    })

    document.querySelectorAll('.job-post-details').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation())
    })

    document.querySelectorAll('.delete-job-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        deleteJob(btn.dataset.jobId, btn)
      })
    })

    if (expandedJobId) {
      const job = jobs.find((j) => j.id === expandedJobId)
      if (job) setupEditForm(job)
      loadApplicantCount(expandedJobId)
    }
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
            <p class="meta">${job.location} · ${job.slots_available} slot(s) available</p>
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
      ${job.status === 'declined' ? '<div class="form-note" style="background:var(--warn-bg); border-color:rgba(184,134,11,0.3); margin-bottom:16px;">This posting was declined by a coordinator. Edit and it will need to be reviewed again once resubmitted.</div>' : ''}

      <div class="field">
        <label>Title</label>
        <input type="text" class="edit-title" value="${(job.title || '').replace(/"/g, '&quot;')}" />
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
        <div class="checkbox-list edit-programs" id="edit-programs-${job.id}"></div>
      </div>
      <div class="field">
        <label>Required Skills — updates based on Eligible Programs selected above</label>
        <div class="checkbox-list edit-skills" id="edit-skills-${job.id}" style="max-height:260px;"></div>
      </div>

      <p class="form-error edit-job-error" style="display:none;"></p>
      <p class="edit-job-success" style="display:none; color:var(--success); font-size:14px; font-weight:600;">✓ Changes saved.</p>

      <div style="display:flex; gap:12px;">
        <button class="btn btn-primary btn-sm save-job-btn" data-job-id="${job.id}" disabled>Save Changes</button>
        <button class="btn btn-ghost btn-sm delete-job-btn" data-job-id="${job.id}">Delete Posting</button>
      </div>
    </div>`
  }

  function serializeCard(card) {
    return JSON.stringify({
      title: card.querySelector('.edit-title').value,
      description: card.querySelector('.edit-description').value,
      location: card.querySelector('.edit-location').value,
      slots: card.querySelector('.edit-slots').value,
      skills: selectedSkillNames(card.querySelector('.edit-skills')).sort(),
      programs: selectedProgramIds(card.querySelector('.edit-programs')).sort(),
    })
  }

  function serializeJob(job) {
    return JSON.stringify({
      title: job.title || '',
      description: job.description || '',
      location: job.location || '',
      slots: String(job.slots_available),
      skills: [...(job.required_skills || [])].sort(),
      programs: [...(job.eligible_programs || [])].sort(),
    })
  }

  function setupEditForm(job) {
    const card = document.querySelector(`.job-post-card[data-job-id="${job.id}"]`)
    if (!card) return
    const saveBtn = card.querySelector('.save-job-btn')
    const successMsg = card.querySelector('.edit-job-success')
    const originalSerialized = serializeJob(job)
    const programsEl = card.querySelector('.edit-programs')
    const skillsEl = card.querySelector('.edit-skills')

    function checkForChanges() {
      const changed = serializeCard(card) !== originalSerialized
      saveBtn.disabled = !changed
      if (changed) successMsg.style.display = 'none'
    }

    function refreshEditSkills() {
      const previouslyChecked = selectedSkillNames(skillsEl)
      renderSkillCheckboxes(skillsEl, availableSkills(selectedProgramIds(programsEl)), previouslyChecked)
      skillsEl.querySelectorAll('.skill-checkbox').forEach((cb) => cb.addEventListener('change', checkForChanges))
    }

    buildProgramCheckboxes(programsEl, job.eligible_programs, `edit-programs-${job.id}`, () => {
      refreshEditSkills()
      checkForChanges()
    })
    renderSkillCheckboxes(skillsEl, availableSkills(job.eligible_programs || []), job.required_skills)
    skillsEl.querySelectorAll('.skill-checkbox').forEach((cb) => cb.addEventListener('change', checkForChanges))

    ;['edit-title', 'edit-description', 'edit-location', 'edit-slots'].forEach((cls) => {
      card.querySelector(`.${cls}`).addEventListener('input', checkForChanges)
    })

    saveBtn.addEventListener('click', () => saveJobEdit(job, card, saveBtn, successMsg))
  }

  async function saveJobEdit(job, card, btn, successMsg) {
    const errorEl = card.querySelector('.edit-job-error')
    errorEl.style.display = 'none'
    successMsg.style.display = 'none'
    btn.disabled = true
    btn.textContent = 'Saving…'

    const selectedPrograms = selectedProgramIds(card.querySelector('.edit-programs'))
    const skills = selectedSkillNames(card.querySelector('.edit-skills'))

    const updates = {
      title: card.querySelector('.edit-title').value,
      description: card.querySelector('.edit-description').value,
      location: card.querySelector('.edit-location').value,
      slots_available: Number(card.querySelector('.edit-slots').value),
      eligible_programs: selectedPrograms,
      required_skills: skills,
    }

    const { error } = await supabase.from('job_postings').update(updates).eq('id', job.id)

    btn.textContent = 'Save Changes'

    if (error) {
      btn.disabled = false
      errorEl.textContent = error.message
      errorEl.style.display = 'block'
      return
    }

    Object.assign(job, updates)
    successMsg.style.display = 'block'
    btn.disabled = true
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

    if (!companyAddress) {
      errorEl.textContent = 'Set an address on your Company Profile before posting a job.'
      errorEl.style.display = 'block'
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Submitting…'

    const selected = selectedProgramIds(createProgramsEl)
    const skills = selectedSkillNames(createSkillsEl)

    const { error } = await supabase.from('job_postings').insert({
      company_id: profile.id,
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      location: companyAddress,
      is_remote: false,
      required_hours: DEFAULT_REQUIRED_HOURS,
      slots_available: Number(document.getElementById('slots').value),
      eligible_programs: selected,
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
    buildProgramCheckboxes(createProgramsEl, [], 'new-job-programs', refreshCreateSkills)
    refreshCreateSkills()
    closeForm()
    loadJobs()
  })

  loadJobs()
}
