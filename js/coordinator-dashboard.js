import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'dashboard.html', profile })
  document.getElementById('subtitle').textContent = profile.full_name

  async function load() {
    const [{ data: jobs }, { data: apps }, studentCount, companyCount, placementCount] = await Promise.all([
      supabase.from('job_postings').select('*, companies(company_name)').eq('status', 'pending_approval'),
      supabase
        .from('applications')
        .select('*, students(programs(name)), job_postings(title, companies(company_name))')
        .eq('status', 'coordinator_review'),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'placement_active'),
    ])

    const pendingJobs = jobs || []
    const pendingApps = apps || []

    document.getElementById('stat-row').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Students</p><p class="stat-value" style="color:var(--maroon);">${studentCount.count || 0}</p></div>
      <div class="stat-card"><p class="stat-label">Partner Companies</p><p class="stat-value" style="color:var(--info);">${companyCount.count || 0}</p></div>
      <div class="stat-card"><p class="stat-label">Active Placements</p><p class="stat-value" style="color:var(--success);">${placementCount.count || 0}</p></div>
      <div class="stat-card"><p class="stat-label">Awaiting Your Review</p><p class="stat-value" style="color:var(--warn);">${pendingJobs.length + pendingApps.length}</p></div>
    `

    const jobsList = document.getElementById('pending-jobs')
    jobsList.innerHTML = pendingJobs.length
      ? pendingJobs
          .map(
            (job) => `
      <div class="row-card">
        <div>
          <p class="title">${job.title}</p>
          <p class="meta">${job.companies?.company_name || ''} · ${job.location} · ${job.required_hours} hrs</p>
        </div>
        <div class="row-actions">
          <span class="badge badge-warn">Pending Approval</span>
          <button class="btn btn-primary btn-sm approve-job-btn" data-job-id="${job.id}">Approve</button>
        </div>
      </div>`
          )
          .join('')
      : '<p class="empty-text">Nothing pending — all caught up.</p>'

    jobsList.querySelectorAll('.approve-job-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        await supabase
          .from('job_postings')
          .update({ status: 'open', approved_by: profile.id, approved_at: new Date().toISOString() })
          .eq('id', btn.dataset.jobId)
        load()
      })
    })

    const appsList = document.getElementById('pending-apps')
    appsList.innerHTML = pendingApps.length
      ? pendingApps
          .map(
            (app) => `
      <div class="row-card">
        <div>
          <p class="title">${app.job_postings?.title || ''}</p>
          <p class="meta">${app.job_postings?.companies?.company_name || ''} · ${app.students?.programs?.name || ''}</p>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm decline-btn" data-app-id="${app.id}">Decline</button>
          <button class="btn btn-primary btn-sm endorse-btn" data-app-id="${app.id}">Approve</button>
        </div>
      </div>`
          )
          .join('')
      : '<p class="empty-text">Nothing pending — all caught up.</p>'

    appsList.querySelectorAll('.endorse-btn, .decline-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        const decision = btn.classList.contains('endorse-btn') ? 'endorsed' : 'rejected'
        await supabase.from('endorsements').insert({
          application_id: btn.dataset.appId,
          coordinator_id: profile.id,
          decision,
        })
        await supabase
          .from('applications')
          .update({ status: decision })
          .eq('id', btn.dataset.appId)
        load()
      })
    })
  }

  load()
}
