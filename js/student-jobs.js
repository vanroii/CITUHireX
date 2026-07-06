import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { uploadDocument } from '../js/storage.js'

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'jobs.html', profile })

  const [{ data: jobs }, { data: myApps }, { data: student }] = await Promise.all([
    supabase.from('job_postings').select('*, companies(company_name)').eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('applications').select('job_posting_id').eq('student_id', profile.id),
    supabase.from('students').select('resume_url').eq('profile_id', profile.id).single(),
  ])

  const hasProfileResume = !!student?.resume_url
  const appliedIds = new Set((myApps || []).map((a) => a.job_posting_id))
  const list = document.getElementById('jobs-list')
  let expandedJobId = null

  function render(jobItems) {
    list.innerHTML = jobItems.length
      ? jobItems
          .map((job) => {
            const applied = appliedIds.has(job.id)
            const expanded = expandedJobId === job.id
            return `
        <div class="row-card" style="flex-direction:column; align-items:stretch;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
            <div>
              <p class="title">${job.title}</p>
              <p class="meta">${job.companies?.company_name || ''} · ${job.location}${job.is_remote ? ' (Remote)' : ''}</p>
              <p class="sub-meta">${job.required_hours} hrs required · ${job.slots_available} slot(s)</p>
            </div>
            <div class="row-actions">
              ${
                applied
                  ? '<span class="badge badge-info">Already Applied</span>'
                  : `<button class="btn btn-primary btn-sm apply-toggle-btn" data-job-id="${job.id}">${expanded ? 'Cancel' : 'Apply'}</button>`
              }
            </div>
          </div>
          ${
            expanded
              ? `
          <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
            <div class="field">
              <label>Resume ${hasProfileResume ? '(leave blank to use the one on your profile)' : '(required — none on file yet)'}</label>
              <input type="file" class="resume-input" accept=".pdf,.doc,.docx" ${hasProfileResume ? '' : 'required'} />
            </div>
            <div class="field">
              <label>Referral Letter (optional)</label>
              <input type="file" class="referral-input" accept=".pdf,.doc,.docx" />
            </div>
            <p class="form-error apply-error" style="display:none;"></p>
            <button class="btn btn-primary btn-sm submit-apply-btn" data-job-id="${job.id}">Submit Application</button>
          </div>`
              : ''
          }
        </div>`
          })
          .join('')
      : '<p class="empty-text">No open postings right now — check back soon.</p>'

    list.querySelectorAll('.apply-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        expandedJobId = expandedJobId === btn.dataset.jobId ? null : btn.dataset.jobId
        render(jobs || [])
      })
    })

    list.querySelectorAll('.submit-apply-btn').forEach((btn) => {
      btn.addEventListener('click', () => submitApplication(btn.dataset.jobId, btn))
    })
  }

  async function submitApplication(jobPostingId, btn) {
    const card = btn.closest('.row-card')
    const errorEl = card.querySelector('.apply-error')
    const resumeFile = card.querySelector('.resume-input').files[0]
    const referralFile = card.querySelector('.referral-input').files[0]

    errorEl.style.display = 'none'

    if (!resumeFile && !hasProfileResume) {
      errorEl.textContent = 'Please attach a resume — none is on file for your profile yet.'
      errorEl.style.display = 'block'
      return
    }

    btn.disabled = true
    btn.textContent = 'Submitting…'

    try {
      let resumePath = student?.resume_url || null
      if (resumeFile) {
        resumePath = await uploadDocument(profile.id, resumeFile, 'resume')
      }
      let referralPath = null
      if (referralFile) {
        referralPath = await uploadDocument(profile.id, referralFile, 'referral')
      }

      const { error } = await supabase.from('applications').insert({
        student_id: profile.id,
        job_posting_id: jobPostingId,
        status: 'submitted',
        resume_url: resumePath,
        referral_letter_url: referralPath,
      })
      if (error) throw error

      appliedIds.add(jobPostingId)
      expandedJobId = null
      render(jobs || [])
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Submit Application'
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    }
  }

  render(jobs || [])
}
