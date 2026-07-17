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
  endorsed: 'Approved',
  placement_active: 'Placement Active',
  completed: 'Completed',
  rejected: 'Not Approved',
}

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'dashboard.html', profile })

  document.getElementById('greeting').textContent = `Welcome back, ${profile.full_name?.split(' ')[0] || 'there'}`

  const [{ data: student }, { data: applications }] = await Promise.all([
    supabase.from('students').select('*, programs(name, required_ojt_hours)').eq('profile_id', profile.id).single(),
    supabase
      .from('applications')
      .select('*, job_postings(title, location, companies(company_name))')
      .eq('student_id', profile.id)
      .order('applied_at', { ascending: false }),
  ])

  document.getElementById('subtitle').textContent = `${student?.programs?.name || ''} · CEA`

  const apps = applications || []
  const pendingCount = apps.filter((a) => a.status === 'coordinator_review').length
  const approvedCount = apps.filter((a) => ['endorsed', 'placement_active', 'completed'].includes(a.status)).length

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><p class="stat-label">Applications Sent</p><p class="stat-value" style="color:var(--maroon);">${apps.length}</p></div>
    <div class="stat-card"><p class="stat-label">Under Coordinator Review</p><p class="stat-value" style="color:var(--warn);">${pendingCount}</p></div>
    <div class="stat-card"><p class="stat-label">Approved Placements</p><p class="stat-value" style="color:var(--success);">${approvedCount}</p></div>
  `

  // Open postings scoped to this student's program: eligible_programs either
  // contains their program id, or is empty (meaning "open to all CEA").
  const jobsList = document.getElementById('open-jobs-list')
  let jobs = []
  if (student?.program_id) {
    const { data } = await supabase
      .from('job_postings')
      .select('*, companies(company_name)')
      .eq('status', 'open')
      .or(`eligible_programs.cs.{${student.program_id}},eligible_programs.eq.{}`)
      .limit(5)
    jobs = data || []
  }

  jobsList.innerHTML = jobs.length
    ? jobs
        .map(
          (job) => `
        <div class="row-card">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.companies?.company_name || ''} · ${job.location}</p>
          </div>
          <span class="badge badge-info">Open</span>
        </div>`
        )
        .join('')
    : `<p class="empty-text">No open postings for ${student?.programs?.name || 'your program'} yet — check <a href="jobs.html" style="color:var(--maroon); font-weight:600;">Browse Jobs</a> for openings across all programs.</p>`

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
