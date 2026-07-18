import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_LABEL = {
  submitted: 'Submitted', company_review: 'Company Review', coordinator_review: 'Coordinator Review',
  endorsed: 'Approved', placement_active: 'Placement Active', completed: 'Completed', rejected: 'Rejected',
}

const JOB_STATUS_LABEL = {
  pending_approval: 'Pending Approval', open: 'Open', closed: 'Closed', declined: 'Declined', archived: 'Archived',
}

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'analytics.html', profile })

  const [{ data: apps }, { data: jobs }, companyCount, studentCount] = await Promise.all([
    supabase.from('applications').select('status'),
    supabase.from('job_postings').select('status'),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }),
  ])

  const appList = apps || []
  const statusCounts = {}
  appList.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  })

  const jobList = jobs || []
  const jobStatusCounts = {}
  jobList.forEach((j) => {
    jobStatusCounts[j.status] = (jobStatusCounts[j.status] || 0) + 1
  })

  const approvedCount = ['endorsed', 'placement_active', 'completed'].reduce(
    (sum, s) => sum + (statusCounts[s] || 0),
    0
  )

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><p class="stat-label">Total Applications</p><p class="stat-value" style="color:var(--maroon);">${appList.length}</p></div>
    <div class="stat-card"><p class="stat-label">Approved Placements</p><p class="stat-value" style="color:var(--success);">${approvedCount}</p></div>
    <div class="stat-card"><p class="stat-label">Students / Companies</p><p class="stat-value" style="color:var(--warn);">${studentCount.count || 0} / ${companyCount.count || 0}</p></div>
  `

  const brandColors = ['#7A0C1E', '#D4A72C', '#2563A8', '#2E7D4F', '#B8860B', '#A31D33', '#4A0812', '#8C8078']

  new Chart(document.getElementById('status-chart'), {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts).map((s) => STATUS_LABEL[s] || s),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: brandColors }],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } } },
  })

  new Chart(document.getElementById('jobs-chart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(jobStatusCounts).map((s) => JOB_STATUS_LABEL[s] || s),
      datasets: [{ data: Object.values(jobStatusCounts), backgroundColor: brandColors }],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } } },
  })
}
