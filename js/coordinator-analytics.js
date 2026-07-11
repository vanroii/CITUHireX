import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_LABEL = {
  submitted: 'Submitted', company_review: 'Company Review', coordinator_review: 'Coordinator Review',
  endorsed: 'Approved', placement_active: 'Placement Active', completed: 'Completed', rejected: 'Rejected',
}

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'analytics.html', profile })

  const [{ data: apps }, { data: students }, companyCount, studentCount] = await Promise.all([
    supabase.from('applications').select('status'),
    supabase.from('students').select('programs(name)'),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }),
  ])

  const appList = apps || []
  const statusCounts = {}
  appList.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  })

  const programCounts = {}
  ;(students || []).forEach((s) => {
    const name = s.programs?.name || 'Unassigned'
    programCounts[name] = (programCounts[name] || 0) + 1
  })

  const completedCount = statusCounts.completed || 0
  const activeCount = statusCounts.placement_active || 0

  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><p class="stat-label">Total Applications</p><p class="stat-value" style="color:var(--maroon);">${appList.length}</p></div>
    <div class="stat-card"><p class="stat-label">Active Placements</p><p class="stat-value" style="color:var(--success);">${activeCount}</p></div>
    <div class="stat-card"><p class="stat-label">Completed Placements</p><p class="stat-value" style="color:var(--info);">${completedCount}</p></div>
    <div class="stat-card"><p class="stat-label">Students / Companies</p><p class="stat-value" style="color:var(--warn);">${studentCount.count || 0} / ${companyCount.count || 0}</p></div>
  `

  const brandColors = ['#7A0C1E', '#D4A72C', '#2563A8', '#2E7D4F', '#B8860B', '#A31D33', '#4A0812', '#8C8078']

  new Chart(document.getElementById('status-chart'), {
    type: 'bar',
    data: {
      labels: Object.keys(statusCounts).map((s) => STATUS_LABEL[s] || s),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: brandColors }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  })

  new Chart(document.getElementById('program-chart'), {
    type: 'bar',
    data: {
      labels: Object.keys(programCounts),
      datasets: [{ data: Object.values(programCounts), backgroundColor: brandColors }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  })
}
