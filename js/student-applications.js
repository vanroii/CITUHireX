import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { uploadDocument, getSignedUrl } from '../js/storage.js'
import { confirmDialog } from '../js/confirm-dialog.js'

const STATUS_KIND = {
  submitted: 'info',
  company_review: 'info',
  coordinator_review: 'warn',
  endorsed: 'success',
  placement_active: 'success',
  completed: 'success',
  rejected: 'warn',
}
const STATUS_LABEL = {
  submitted: 'Pending',
  company_review: 'Company Reviewing',
  coordinator_review: 'Coordinator Reviewing',
  endorsed: 'Approved',
  placement_active: 'Placement Active',
  completed: 'Completed',
  rejected: 'Not Approved',
}

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'applications.html', profile })

  const list = document.getElementById('applications-list')
  let apps = []
  let expandedId = null
  let allPrograms = []

  function programNames(idList) {
    if (!idList || idList.length === 0) return 'Open to all CEA'
    return idList.map((id) => allPrograms.find((p) => p.id === id)?.name || 'Unknown').join(', ')
  }

  async function loadApps() {
    const [{ data }, { data: programs }] = await Promise.all([
      supabase
        .from('applications')
        .select(
          '*, job_postings(title, description, location, required_hours, is_remote, required_skills, eligible_programs, company_id, companies(company_name)), endorsements(decision, remarks, decided_at)'
        )
        .eq('student_id', profile.id)
        .order('applied_at', { ascending: false }),
      supabase.from('programs').select('id, name'),
    ])
    apps = data || []
    allPrograms = programs || []
    render()
  }

  function render() {
    list.innerHTML = apps.length
      ? apps.map((app) => renderCard(app)).join('')
      : '<p class="empty-text">You haven\'t applied to anything yet — head to <a href="jobs.html" style="color:var(--maroon); font-weight:600;">Browse Jobs</a> to get started.</p>'

    document.querySelectorAll('.app-card-header').forEach((header) => {
      header.addEventListener('click', () => {
        const id = header.closest('.app-card').dataset.appId
        expandedId = expandedId === id ? null : id
        render()
        if (expandedId === id) loadDocumentLinks(id)
      })
    })

    document.querySelectorAll('.app-details').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation())
    })

    document.querySelectorAll('.save-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        saveEdit(btn.dataset.appId, btn)
      })
    })

    document.querySelectorAll('.withdraw-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        withdrawApplication(btn.dataset.appId, btn)
      })
    })
  }

  async function loadDocumentLinks(appId) {
    const app = apps.find((a) => a.id === appId)
    if (!app) return
    const resumeEl = document.getElementById(`resume-link-${appId}`)
    const referralEl = document.getElementById(`referral-link-${appId}`)

    if (resumeEl && app.resume_url) {
      const url = await getSignedUrl(app.resume_url)
      resumeEl.innerHTML = url
        ? `<a href="${url}" target="_blank" rel="noopener" style="color:var(--maroon); font-size:15px; font-weight:600;">View current resume</a>`
        : 'Resume on file (link unavailable)'
    }
    if (referralEl && app.referral_letter_url) {
      const url = await getSignedUrl(app.referral_letter_url)
      referralEl.innerHTML = url
        ? `<a href="${url}" target="_blank" rel="noopener" style="color:var(--maroon); font-size:15px; font-weight:600;">View current referral letter</a>`
        : 'Referral letter on file (link unavailable)'
    }
  }

  function renderCard(app) {
    const expanded = expandedId === app.id
    const editable = app.status === 'submitted'
    const job = app.job_postings || {}
    const lastEndorsement = (app.endorsements || []).slice(-1)[0]

    return `
      <div class="row-card app-card" style="flex-direction:column; align-items:stretch;" data-app-id="${app.id}">
        <div class="app-card-header" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${job.title || ''}</p>
            <p class="meta">${job.companies?.company_name || ''} · ${job.location || ''}</p>
            <p class="sub-meta">Applied ${new Date(app.applied_at).toLocaleDateString()}</p>
          </div>
          <div class="row-actions">
            <span class="badge badge-${STATUS_KIND[app.status] || 'info'}">${STATUS_LABEL[app.status] || app.status}</span>
            <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide details ▲' : 'View details ▼'}</span>
          </div>
        </div>
        ${expanded ? renderDetails(app, job, editable, lastEndorsement) : ''}
      </div>`
  }

  function renderDetails(app, job, editable, lastEndorsement) {
    const skillsHtml = (job.required_skills || [])
      .map((s) => `<span class="skill-chip">${s}</span>`)
      .join('') || '<p class="sub-meta">No specific skills listed.</p>'

    const endorsementHistory = (app.endorsements || [])
      .map(
        (e) => `
      <div style="padding:10px 0; border-top:1px solid var(--gray-200);">
        <p class="sub-meta" style="margin:0;"><strong>${e.decision === 'endorsed' ? 'Approved' : e.decision === 'rejected' ? 'Not approved' : 'Needs revision'}</strong> · ${new Date(e.decided_at).toLocaleDateString()}</p>
        ${e.remarks ? `<p class="sub-meta" style="margin:4px 0 0;">"${e.remarks}"</p>` : ''}
      </div>`
      )
      .join('')

    return `
    <div class="app-details" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
      <p style="font-size:14px; line-height:1.6; color:var(--gray-700); margin:0 0 16px;">${job.description || 'No description provided.'}</p>
      <p class="sub-meta" style="margin-bottom:8px; font-weight:700;">Required skills</p>
      <div style="margin-bottom:16px;">${skillsHtml}</div>
      <p class="sub-meta" style="margin-bottom:8px;"><strong>Eligible programs:</strong> ${programNames(job.eligible_programs)}</p>

      ${endorsementHistory ? `<p class="sub-meta" style="margin:16px 0 0; font-weight:700;">Coordinator history</p>${endorsementHistory}` : ''}

      ${
        job.company_id
          ? `<a href="messages.html?with=${job.company_id}" class="btn btn-ghost btn-sm" style="margin-top:16px; display:inline-flex;">💬 Message ${job.companies?.company_name || 'Company'}</a>`
          : ''
      }

      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--gray-200);">
        ${
          editable
            ? `
        <p class="form-note" style="margin-bottom:16px;">Your application is still pending — you can update it below or delete it before it's reviewed.</p>
        <div class="field">
          <label>Resume (leave blank to keep current)</label>
          <p class="sub-meta" id="resume-link-${app.id}" style="margin:0 0 8px;">Loading…</p>
          <input type="file" class="edit-resume-input" accept=".pdf,.doc,.docx" />
        </div>
        <div class="field">
          <label>Referral Letter (leave blank to keep current)</label>
          <p class="sub-meta" id="referral-link-${app.id}" style="margin:0 0 8px; font-size:14px;">${app.referral_letter_url ? 'Loading…' : 'None attached.'}</p>
          <input type="file" class="edit-referral-input" accept=".pdf,.doc,.docx" />
        </div>
        <div class="field">
          <label>Cover Note</label>
          <textarea class="edit-cover-note" rows="3">${app.cover_note || ''}</textarea>
        </div>
        <p class="form-error edit-error" style="display:none;"></p>
        <div style="display:flex; gap:12px;">
          <button class="btn btn-primary btn-sm save-edit-btn" data-app-id="${app.id}">Save Changes</button>
          <button class="btn btn-ghost btn-sm withdraw-btn" data-app-id="${app.id}">Delete Application</button>
        </div>
        `
            : `
        <p class="sub-meta" id="resume-link-${app.id}" style="margin:0 0 6px;">${app.resume_url ? 'Loading…' : 'No resume attached.'}</p>
        <p class="sub-meta" id="referral-link-${app.id}" style="margin:0 0 6px;">${app.referral_letter_url ? 'Loading…' : 'No referral letter attached.'}</p>
        ${app.cover_note ? `<p class="sub-meta" style="margin-top:8px;">Cover note: "${app.cover_note}"</p>` : ''}
        <p class="form-note" style="margin-top:16px;">This application is no longer editable — it's already being reviewed.</p>
        `
        }
      </div>
    </div>`
  }

  async function saveEdit(appId, btn) {
    const card = btn.closest('.app-card')
    const errorEl = card.querySelector('.edit-error')
    const resumeFile = card.querySelector('.edit-resume-input')?.files[0]
    const referralFile = card.querySelector('.edit-referral-input')?.files[0]
    const coverNote = card.querySelector('.edit-cover-note')?.value || ''
    errorEl.style.display = 'none'

    btn.disabled = true
    btn.textContent = 'Saving…'

    try {
      const updates = { cover_note: coverNote }
      if (resumeFile) updates.resume_url = await uploadDocument(profile.id, resumeFile, 'resume')
      if (referralFile) updates.referral_letter_url = await uploadDocument(profile.id, referralFile, 'referral')

      // RLS only allows this while status = 'submitted' — enforced server-side too,
      // not just by hiding the form here.
      const { error } = await supabase.from('applications').update(updates).eq('id', appId)
      if (error) throw error

      await loadApps()
      expandedId = appId
      render()
      loadDocumentLinks(appId)
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Save Changes'
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    }
  }

  async function withdrawApplication(appId, btn) {
    const ok = await confirmDialog(
      'Delete this application?',
      'This cannot be undone. Your resume and referral letter for this application will also be removed.',
      'Delete'
    )
    if (!ok) return

    btn.disabled = true
    btn.textContent = 'Deleting…'

    const { error } = await supabase.from('applications').delete().eq('id', appId)
    if (error) {
      btn.disabled = false
      btn.textContent = 'Delete Application'
      alert(error.message)
      return
    }

    expandedId = null
    await loadApps()
  }

  loadApps()
}
