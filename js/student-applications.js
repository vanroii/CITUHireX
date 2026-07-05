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
  renderSidebar({ role: 'student', activePage: 'applications.html', profile })

  const { data: apps } = await supabase
    .from('applications')
    .select('*, job_postings(title, location, required_hours, companies(company_name)), endorsements(decision, remarks, decided_at)')
    .eq('student_id', profile.id)
    .order('applied_at', { ascending: false })

  const list = document.getElementById('applications-list')
  const items = apps || []

  list.innerHTML = items.length
    ? items
        .map((app) => {
          const lastEndorsement = (app.endorsements || []).slice(-1)[0]
          return `
      <div class="row-card" style="align-items:flex-start;">
        <div>
          <p class="title">${app.job_postings?.title || ''}</p>
          <p class="meta">${app.job_postings?.companies?.company_name || ''} · ${app.job_postings?.location || ''}</p>
          <p class="sub-meta">Applied ${new Date(app.applied_at).toLocaleDateString()}</p>
          ${lastEndorsement?.remarks ? `<p class="sub-meta" style="margin-top:8px;">Coordinator note: "${lastEndorsement.remarks}"</p>` : ''}
        </div>
        <span class="badge badge-${STATUS_KIND[app.status] || 'info'}">${STATUS_LABEL[app.status] || app.status}</span>
      </div>`
        })
        .join('')
    : '<p class="empty-text">You haven\'t applied to anything yet — head to Browse Jobs to get started.</p>'
}
