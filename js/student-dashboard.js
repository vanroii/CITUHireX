import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

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
  submitted: 'Submitted',
  company_review: 'Company Reviewing',
  coordinator_review: 'Pending Coordinator Review',
  endorsed: 'Endorsed',
  placement_active: 'Placement Active',
  completed: 'Completed',
  rejected: 'Not Endorsed',
}

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'dashboard.html', profile })

  document.getElementById('greeting').textContent = `Welcome back, ${profile.full_name?.split(' ')[0] || 'there'}`

  const [{ data: student }, { data: applications }, { data: openJobs }] = await Promise.all([
    supabase.from('students').select('*, programs(name, required_ojt_hours)').eq('profile_id', profile.id).single(),
    supabase
      .from('applications')
      .select('*, job_postings(title, location, companies(company_name))')
      .eq('student_id', profile.id)
      .order('applied_at', { ascending: false }),
    supabase.from('job_postings').select('*, companies(company_name)').eq('status', 'open').limit(5),
  ])

  document.getElementById('subtitle').textContent = `${student?.programs?.name || ''} · CEA`

  const apps = applications || []
  const pendingCount = apps.filter((a) => a.status === 'coordinator_review').length
  const approvedCount = apps.filter((a) => ['endorsed', 'placement_active', 'completed'].includes(a.status)).length

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><p class="stat-label">Applications Sent</p><p class="stat-value" style="color:var(--maroon);">${apps.length}</p></div>
    <div class="stat-card"><p class="stat-label">Under Coordinator Review</p><p class="stat-value" style="color:var(--warn);">${pendingCount}</p></div>
    <div class="stat-card"><p class="stat-label">Approved Placements</p><p class="stat-value" style="color:var(--success);">${approvedCount}</p></div>
    <div class="stat-card"><p class="stat-label">Required OJT Hours</p><p class="stat-value" style="color:var(--info);">${student?.completed_hours ?? 0} / ${student?.programs?.required_ojt_hours ?? '—'}</p></div>
  `

  const jobsList = document.getElementById('open-jobs-list')
  const jobs = openJobs || []
  jobsList.innerHTML = jobs.length
    ? jobs
        .map(
          (job) => `
        <div class="row-card">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.companies?.company_name || ''} · ${job.location}</p>
            <p class="sub-meta">${job.required_hours} hrs</p>
          </div>
          <span class="badge badge-info">Open</span>
        </div>`
        )
        .join('')
    : '<p class="empty-text">No open postings yet — check back soon.</p>'

  if (apps.length > 0) {
    document.getElementById('applications-heading').style.display = 'block'
    document.getElementById('applications-list').innerHTML = apps
      .map(
        (app) => `
      <div class="row-card">
        <div>
          <p class="title">${app.job_postings?.title || ''}</p>
          <p class="meta">${app.job_postings?.companies?.company_name || ''}</p>
        </div>
        <span class="badge badge-${STATUS_KIND[app.status] || 'info'}">${STATUS_LABEL[app.status] || app.status}</span>
      </div>`
      )
      .join('')
  }
}
