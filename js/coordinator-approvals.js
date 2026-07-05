import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'approvals.html', profile })

  async function loadJobs() {
    const { data: jobs } = await supabase
      .from('job_postings')
      .select('*, companies(company_name)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true })

    const el = document.getElementById('pending-jobs')
    el.innerHTML = jobs && jobs.length
      ? jobs
          .map(
            (job) => `
      <div class="row-card">
        <div>
          <p class="title">${job.title}</p>
          <p class="meta">${job.companies?.company_name || ''} · ${job.location} · ${job.required_hours} hrs · ${job.slots_available} slot(s)</p>
          <p class="sub-meta">${job.description || ''}</p>
        </div>
        <div class="row-actions">
          <button class="btn btn-primary btn-sm approve-job-btn" data-job-id="${job.id}">Approve</button>
        </div>
      </div>`
          )
          .join('')
      : '<p class="empty-text">No postings waiting on approval.</p>'

    el.querySelectorAll('.approve-job-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        btn.textContent = 'Approving…'
        await supabase
          .from('job_postings')
          .update({ status: 'open', approved_by: profile.id, approved_at: new Date().toISOString() })
          .eq('id', btn.dataset.jobId)
        loadJobs()
      })
    })
  }

  async function loadApps() {
    const { data: apps } = await supabase
      .from('applications')
      .select('*, students(programs(name), profiles(full_name)), job_postings(title, companies(company_name))')
      .eq('status', 'coordinator_review')
      .order('applied_at', { ascending: true })

    const el = document.getElementById('pending-apps')
    el.innerHTML = apps && apps.length
      ? apps
          .map(
            (app) => `
      <div class="row-card" style="align-items:flex-start; flex-direction:column;">
        <div style="width:100%; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${app.students?.profiles?.full_name || 'Applicant'}</p>
            <p class="meta">${app.job_postings?.title || ''} · ${app.job_postings?.companies?.company_name || ''}</p>
            <p class="sub-meta">${app.students?.programs?.name || ''}</p>
          </div>
        </div>
        <div style="width:100%; margin-top:12px;">
          <input type="text" class="remarks-input" data-app-id="${app.id}" placeholder="Remarks (optional)"
            style="width:100%; border:1px solid var(--gray-300); border-radius:8px; padding:10px 14px; font-size:13px; margin-bottom:12px;" />
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm decline-btn" data-app-id="${app.id}">Decline</button>
            <button class="btn btn-primary btn-sm endorse-btn" data-app-id="${app.id}">Endorse</button>
          </div>
        </div>
      </div>`
          )
          .join('')
      : '<p class="empty-text">No applications waiting on endorsement.</p>'

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

  loadJobs()
  loadApps()
}
