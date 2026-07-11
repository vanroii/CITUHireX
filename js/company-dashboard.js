import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_KIND = {
  submitted: 'info', company_review: 'info', coordinator_review: 'warn',
  endorsed: 'success', placement_active: 'success', completed: 'success', rejected: 'warn',
}
const STATUS_LABEL = {
  submitted: 'New', company_review: 'Reviewing', coordinator_review: 'Pending Coordinator',
  endorsed: 'Approved', placement_active: 'Placement Active', completed: 'Completed', rejected: 'Rejected',
}

// A "placement" counts from the moment a coordinator approves the student —
// endorsed, placement_active, and completed are all past that point.
const PLACED_STATUSES = ['endorsed', 'placement_active', 'completed']

const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'dashboard.html', profile })

  const { data: company } = await supabase.from('companies').select('*').eq('profile_id', profile.id).single()
  document.getElementById('greeting').textContent = company?.company_name || profile.full_name

  if (!company?.is_verified) {
    document.getElementById('verify-notice').innerHTML = `
      <div class="form-note">
        Your company account is awaiting coordinator verification. Job postings won't be visible to
        students until you're verified.
      </div>`
  }

  const { data: jobs } = await supabase.from('job_postings').select('*').eq('company_id', profile.id)

  // Fetched in full (no limit) so the stats below are accurate — a company
  // with more than 10 applicants would otherwise undercount everything.
  const { data: applicants } = await supabase
    .from('applications')
    .select('*, students(profile_id, programs(name), profiles(full_name)), job_postings!inner(company_id, title)')
    .eq('job_postings.company_id', profile.id)
    .order('applied_at', { ascending: false })

  const jobList = jobs || []
  const appList = applicants || []
  const recentApplicants = appList.slice(0, 10) // only the table display is capped

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><p class="stat-label">Active Postings</p><p class="stat-value" style="color:var(--maroon);">${jobList.filter((j) => j.status === 'open').length}</p></div>
    <div class="stat-card"><p class="stat-label">Total Applicants</p><p class="stat-value" style="color:var(--info);">${appList.length}</p></div>
    <div class="stat-card"><p class="stat-label">Pending Coordinator Approval</p><p class="stat-value" style="color:var(--warn);">${jobList.filter((j) => j.status === 'pending_approval').length}</p></div>
    <div class="stat-card"><p class="stat-label">Placements Completed</p><p class="stat-value" style="color:var(--success);">${appList.filter((a) => PLACED_STATUSES.includes(a.status)).length}</p></div>
  `

  const table = document.getElementById('applicants-table')
  table.innerHTML = `
    <div class="thead-row" style="grid-template-columns: 2fr 2fr 1.5fr 1fr;">
      <span>Applicant</span><span>Job Posting</span><span>Program</span><span>Status</span>
    </div>
    ${
      recentApplicants.length
        ? recentApplicants
            .map(
              (a) => `
      <div class="trow" style="grid-template-columns: 2fr 2fr 1.5fr 1fr;">
        <span style="font-weight:600;">${a.students?.profiles?.full_name || 'Applicant'}</span>
        <span>${a.job_postings?.title || ''}</span>
        <span>${a.students?.programs?.name || ''}</span>
        <span class="badge badge-${STATUS_KIND[a.status] || 'info'}">${STATUS_LABEL[a.status] || a.status}</span>
      </div>`
            )
            .join('')
        : '<p class="empty">No applicants yet.</p>'
    }
  `
}
