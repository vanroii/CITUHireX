import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'jobs.html', profile })

  const [{ data: jobs }, { data: myApps }] = await Promise.all([
    supabase.from('job_postings').select('*, companies(company_name)').eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('applications').select('job_posting_id').eq('student_id', profile.id),
  ])

  const appliedIds = new Set((myApps || []).map((a) => a.job_posting_id))
  const list = document.getElementById('jobs-list')

  function render(jobItems) {
    list.innerHTML = jobItems.length
      ? jobItems
          .map((job) => {
            const applied = appliedIds.has(job.id)
            return `
        <div class="row-card">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.companies?.company_name || ''} · ${job.location}${job.is_remote ? ' (Remote)' : ''}</p>
            <p class="sub-meta">${job.required_hours} hrs required · ${job.slots_available} slot(s)</p>
          </div>
          <div class="row-actions">
            ${
              applied
                ? '<span class="badge badge-info">Already Applied</span>'
                : `<button class="btn btn-primary btn-sm apply-btn" data-job-id="${job.id}">Apply</button>`
            }
          </div>
        </div>`
          })
          .join('')
      : '<p class="empty-text">No open postings right now — check back soon.</p>'

    list.querySelectorAll('.apply-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyToJob(btn.dataset.jobId, btn))
    })
  }

  async function applyToJob(jobPostingId, btn) {
    btn.disabled = true
    btn.textContent = 'Applying…'

    const { error } = await supabase.from('applications').insert({
      student_id: profile.id,
      job_posting_id: jobPostingId,
      status: 'submitted',
    })

    if (error) {
      document.getElementById('error-msg').textContent = error.message
      document.getElementById('error-msg').style.display = 'block'
      btn.disabled = false
      btn.textContent = 'Apply'
      return
    }

    appliedIds.add(jobPostingId)
    render(jobs || [])
  }

  render(jobs || [])
}
