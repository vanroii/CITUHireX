import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { getSignedUrl } from '../js/storage.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'approvals.html', profile })

  let expandedJobId = null
  let expandedAppJobId = null // which application's "View Job" panel is open

  const { data: allPrograms } = await supabase.from('programs').select('id, name')

  function programNames(idList) {
    if (!idList || idList.length === 0) return 'Open to all CEA'
    return idList.map((id) => (allPrograms || []).find((p) => p.id === id)?.name || 'Unknown').join(', ')
  }

  function skillChips(skills) {
    return (skills || []).length
      ? skills.map((s) => `<span class="skill-chip">${s}</span>`).join('')
      : '<p class="sub-meta">No specific skills listed.</p>'
  }

  async function loadJobs() {
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('*, companies(company_name)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true })

    const el = document.getElementById('pending-jobs')
    el.innerHTML = jobs && jobs.length
      ? jobs.map((job) => renderJobCard(job)).join('')
      : '<p class="empty-text">No postings waiting on approval.</p>'

    el.querySelectorAll('.job-approval-header').forEach((header) => {
      header.addEventListener('click', () => {
        const id = header.closest('.job-approval-card').dataset.jobId
        expandedJobId = expandedJobId === id ? null : id
        loadJobs()
      })
    })

    el.querySelectorAll('.job-approval-details').forEach((d) => d.addEventListener('click', (e) => e.stopPropagation()))

    el.querySelectorAll('.approve-job-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        btn.disabled = true
        btn.textContent = 'Approving…'
        await supabase
          .from('job_postings')
          .update({ status: 'open', approved_by: profile.id, approved_at: new Date().toISOString() })
          .eq('id', btn.dataset.jobId)
        expandedJobId = null
        loadJobs()
      })
    })
  }

  function renderJobCard(job) {
    const expanded = expandedJobId === job.id
    return `
    <div class="row-card job-approval-card" style="flex-direction:column; align-items:stretch;" data-job-id="${job.id}">
      <div class="job-approval-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
        <div>
          <p class="title">${job.title}</p>
          <p class="meta">${job.companies?.company_name || ''} · ${job.location} · ${job.slots_available} slot(s)</p>
        </div>
        <div class="row-actions">
          <span class="badge badge-warn">Pending Approval</span>
          <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide details ▲' : 'View details ▼'}</span>
        </div>
      </div>
      ${
        expanded
          ? `
      <div class="job-approval-details" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
        <p style="font-size:14px; line-height:1.6; color:var(--gray-700); margin:0 0 16px;">${job.description || 'No description provided.'}</p>
        <p class="sub-meta" style="margin-bottom:8px; font-weight:700;">Required skills</p>
        <div style="margin-bottom:16px;">${skillChips(job.required_skills)}</div>
        <p class="sub-meta" style="margin-bottom:4px;"><strong>Eligible programs:</strong> ${programNames(job.eligible_programs)}</p>
        <p class="sub-meta">${job.required_hours || '—'} hrs${job.is_remote ? ' · Remote' : ''}</p>
        <div class="row-actions" style="margin-top:16px;">
          <a href="messages.html?with=${job.company_id}" class="btn btn-ghost btn-sm">💬 Message</a>
          <button class="btn btn-primary btn-sm approve-job-btn" data-job-id="${job.id}">Approve</button>
        </div>
      </div>`
          : ''
      }
    </div>`
  }

  async function loadApps() {
    const { data: apps } = await supabase
      .from('applications')
      .select(
        '*, students(profile_id, programs(name), profiles(full_name)), job_postings(title, description, location, required_hours, required_skills, is_remote, company_id, companies(company_name))'
      )
      .eq('status', 'coordinator_review')
      .order('applied_at', { ascending: true })

    const el = document.getElementById('pending-apps')
    el.innerHTML = apps && apps.length
      ? apps.map((app) => renderAppCard(app)).join('')
      : '<p class="empty-text">No applications waiting on approval.</p>'

    el.querySelectorAll('.view-job-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.appId
        expandedAppJobId = expandedAppJobId === id ? null : id
        loadApps()
      })
    })

    el.querySelectorAll('.doc-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const original = btn.textContent
        btn.disabled = true
        btn.textContent = 'Opening…'
        const url = await getSignedUrl(btn.dataset.path)
        btn.disabled = false
        btn.textContent = original
        if (url) window.open(url, '_blank', 'noopener')
        else alert("Couldn't generate a link for this document.")
      })
    })

    el.querySelectorAll('.endorse-btn, .decline-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.appId
        const remarksInput = el.querySelector(`.remarks-input[data-app-id="${appId}"]`)
        const decision = btn.classList.contains('endorse-btn') ? 'endorsed' : 'rejected'

        btn.disabled = true
        await supabase.from('endorsements').insert({
          application_id: appId,
          coordinator_id: profile.id,
          decision,
          remarks: remarksInput?.value || null,
        })
        await supabase.from('applications').update({ status: decision }).eq('id', appId)
        loadApps()
      })
    })
  }

  function renderAppCard(app) {
    const job = app.job_postings || {}
    const showJob = expandedAppJobId === app.id
    return `
      <div class="row-card" style="align-items:flex-start; flex-direction:column;">
        <div style="width:100%; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${app.students?.profiles?.full_name || 'Applicant'}</p>
            <p class="meta">${job.title || ''} · ${job.companies?.company_name || ''}</p>
            <p class="sub-meta">${app.students?.programs?.name || ''}</p>
          </div>
          <button class="btn btn-ghost btn-sm view-job-btn" data-app-id="${app.id}">${showJob ? 'Hide Job ▲' : 'View Job ▼'}</button>
        </div>
        ${
          showJob
            ? `
        <div style="width:100%; margin-top:12px; padding:16px; background:var(--gray-100); border-radius:10px;">
          <p style="font-size:14px; line-height:1.6; color:var(--gray-700); margin:0 0 12px;">${job.description || 'No description provided.'}</p>
          <p class="sub-meta" style="margin-bottom:8px; font-weight:700;">Required skills</p>
          <div style="margin-bottom:12px;">${skillChips(job.required_skills)}</div>
          <p class="sub-meta">${job.location || ''} · ${job.required_hours || '—'} hrs${job.is_remote ? ' · Remote' : ''}</p>
        </div>`
            : ''
        }
        <div style="width:100%; margin-top:12px;">
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            ${app.resume_url ? `<button class="btn btn-ghost btn-sm doc-btn" data-path="${app.resume_url}">View Resume</button>` : ''}
            ${app.referral_letter_url ? `<button class="btn btn-ghost btn-sm doc-btn" data-path="${app.referral_letter_url}">View Referral Letter</button>` : ''}
            ${!app.resume_url && !app.referral_letter_url ? '<span class="sub-meta">No documents attached</span>' : ''}
          </div>
          <input type="text" class="remarks-input" data-app-id="${app.id}" placeholder="Remarks (optional)"
            style="width:100%; border:1px solid var(--gray-300); border-radius:8px; padding:10px 14px; font-size:13px; margin-bottom:12px;" />
          <div class="row-actions">
            <a href="messages.html?with=${app.students?.profile_id}" class="btn btn-ghost btn-sm">💬 Student</a>
            <a href="messages.html?with=${job.company_id}" class="btn btn-ghost btn-sm">💬 Company</a>
            <button class="btn btn-ghost btn-sm decline-btn" data-app-id="${app.id}">Decline</button>
            <button class="btn btn-primary btn-sm endorse-btn" data-app-id="${app.id}">Approve</button>
          </div>
        </div>
      </div>`
  }

  loadJobs()
  loadApps()
}
