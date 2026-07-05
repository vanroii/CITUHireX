import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

// Companies can only move an application through their part of the workflow.
// Coordinator-only outcomes (endorsed/rejected) happen on the Coordinator side.
const COMPANY_STATUSES = ['submitted', 'company_review', 'coordinator_review']
const STATUS_KIND = {
  submitted: 'info', company_review: 'info', coordinator_review: 'warn',
  endorsed: 'success', placement_active: 'success', completed: 'success', rejected: 'warn',
}
const STATUS_LABEL = {
  submitted: 'New', company_review: 'Reviewing', coordinator_review: 'Sent to Coordinator',
  endorsed: 'Endorsed', placement_active: 'Placement Active', completed: 'Completed', rejected: 'Rejected',
}

const auth = await requireRole('company')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'company', activePage: 'applicants.html', profile })

  const table = document.getElementById('applicants-table')

  async function load() {
    const { data: applicants } = await supabase
      .from('applications')
      .select('*, students(profile_id, programs(name), profiles(full_name)), job_postings!inner(company_id, title)')
      .eq('job_postings.company_id', profile.id)
      .order('applied_at', { ascending: false })

    const list = applicants || []

    table.innerHTML = `
      <div class="thead-row" style="grid-template-columns: 1.8fr 1.8fr 1.4fr 1fr 1.4fr;">
        <span>Applicant</span><span>Job Posting</span><span>Program</span><span>Applied</span><span>Status</span>
      </div>
      ${
        list.length
          ? list
              .map(
                (a) => `
        <div class="trow" style="grid-template-columns: 1.8fr 1.8fr 1.4fr 1fr 1.4fr;">
          <span style="font-weight:600;">${a.students?.profiles?.full_name || 'Applicant'}</span>
          <span>${a.job_postings?.title || ''}</span>
          <span>${a.students?.programs?.name || ''}</span>
          <span>${new Date(a.applied_at).toLocaleDateString()}</span>
          <span>
            ${
              COMPANY_STATUSES.includes(a.status)
                ? `<select class="status-select" data-app-id="${a.id}" style="border:1px solid var(--gray-300); border-radius:8px; padding:6px 10px; font-size:13px;">
                    ${COMPANY_STATUSES.map((s) => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
                  </select>`
                : `<span class="badge badge-${STATUS_KIND[a.status] || 'info'}">${STATUS_LABEL[a.status] || a.status}</span>`
            }
          </span>
        </div>`
              )
              .join('')
          : '<p class="empty">No applicants yet.</p>'
      }
    `

    table.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await supabase.from('applications').update({ status: sel.value }).eq('id', sel.dataset.appId)
        load()
      })
    })
  }

  load()
}
