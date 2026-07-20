import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'
import { uploadDocument } from '../js/storage.js'

const auth = await requireRole('student')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'student', activePage: 'jobs.html', profile })

  const [{ data: jobs }, { data: myApps }, { data: student }, { data: programs }] = await Promise.all([
    supabase.from('job_postings').select('*, companies(company_name)').eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('applications').select('job_posting_id').eq('student_id', profile.id),
    supabase.from('students').select('resume_url, skills, preferred_location, program_id').eq('profile_id', profile.id).single(),
    supabase.from('programs').select('id, name'),
  ])

  const allPrograms = programs || []
  function programNames(idList) {
    if (!idList || idList.length === 0) return 'Open to all CEA'
    return idList.map((id) => allPrograms.find((p) => p.id === id)?.name || 'Unknown').join(', ')
  }

  const hasProfileResume = !!student?.resume_url
  const appliedIds = new Set((myApps || []).map((a) => a.job_posting_id))

  // Eligibility gate: a job only appears here if it's open to all CEA
  // (empty eligible_programs) or specifically includes the student's own
  // program. This applies before matching/sorting, so Browse Jobs never
  // shows a posting the student can't actually apply their program to.
  const studentProgramId = student?.program_id || null
  const allJobs = (jobs || []).filter(
    (job) => !job.eligible_programs || job.eligible_programs.length === 0 || job.eligible_programs.includes(studentProgramId)
  )

  // --- Matching: the core objective of this platform. A job qualifies as
  // "Matched" if it matches on skills OR location (not both required) —
  // but jobs matching BOTH rank first, skill-only matches next, and
  // location-only matches last. Remote postings satisfy the location side
  // for everyone. Location matching compares CITY ONLY — barangay is
  // intentionally independent, so a different barangay within the same
  // city/municipality still counts as a location match. ---
  const studentSkills = (student?.skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean)

  // Both preferred_location ("Barangay, City") and job.location
  // ("Street, Barangay, City") end with the city/municipality — take the
  // last comma-separated segment as "the city" for comparison.
  function extractCity(str) {
    if (!str) return ''
    const parts = str.split(',').map((s) => s.trim()).filter(Boolean)
    return (parts[parts.length - 1] || '').toLowerCase()
  }
  const studentCity = extractCity(student?.preferred_location)

  function matchInfo(job) {
    const requiredSkills = job.required_skills || []
    const requiredLower = requiredSkills.map((s) => s.trim().toLowerCase())
    const matchedSkills = requiredSkills.filter((_, i) =>
      studentSkills.some((s) => requiredLower[i] === s || requiredLower[i].includes(s) || s.includes(requiredLower[i]))
    )

    const jobCity = extractCity(job.location)
    const locationMatch = job.is_remote || (!!studentCity && !!jobCity && studentCity === jobCity)

    return {
      matchCount: matchedSkills.length,
      matchedSkillsLower: matchedSkills.map((m) => m.toLowerCase()),
      locationMatch,
    }
  }

  // Tier 0 = skills + location both matched, Tier 1 = skills only, Tier 2 = location only.
  function tierOf(info) {
    if (info.matchCount > 0 && info.locationMatch) return 0
    if (info.matchCount > 0) return 1
    return 2
  }

  const matchedJobs = allJobs
    .map((job) => ({ job, info: matchInfo(job) }))
    .filter((x) => x.info.matchCount > 0 || x.info.locationMatch)
    .sort((a, b) => {
      const tierDiff = tierOf(a.info) - tierOf(b.info)
      if (tierDiff !== 0) return tierDiff
      return b.info.matchCount - a.info.matchCount
    })

  const matchedHeading = document.getElementById('matched-heading')
  const matchedSubtitle = document.getElementById('matched-subtitle')
  const matchedList = document.getElementById('matched-jobs-list')
  const browseList = document.getElementById('jobs-list')

  matchedHeading.style.display = 'block'
  matchedSubtitle.style.display = 'block'
  matchedSubtitle.textContent = 'Based on the skills and preferred location on your profile'

  if (!studentSkills.length && !studentCity) {
    matchedList.innerHTML = `<p class="empty-text">Add skills and a preferred location to <a href="profile.html" style="color:var(--maroon); font-weight:600;">your profile</a> to see jobs matched to you here.</p>`
  } else if (matchedJobs.length === 0) {
    matchedList.innerHTML = `<p class="empty-text">No postings currently match your skills or preferred location. Browse everything below, or update your <a href="profile.html" style="color:var(--maroon); font-weight:600;">profile</a>.</p>`
  }

  let expandedJobId = null

  function skillChips(job, matchedSkillsLower) {
    const skills = job.required_skills || []
    if (!skills.length) return '<p class="sub-meta">No specific skills listed.</p>'
    return skills
      .map((s) => {
        const isMatched = matchedSkillsLower ? matchedSkillsLower.includes(s.toLowerCase()) : false
        return `<span class="skill-chip ${isMatched ? 'matched' : ''}">${s}</span>`
      })
      .join('')
  }

  function renderJobCard(job, info) {
    const applied = appliedIds.has(job.id)
    const expanded = expandedJobId === job.id
    const matchedSkillsLower = info?.matchedSkillsLower

    const matchParts = []
    if (info) {
      if (info.matchCount > 0) matchParts.push(`${info.matchCount} skill${info.matchCount === 1 ? '' : 's'} matched`)
      if (info.locationMatch) matchParts.push('location matched')
    }
    const matchLine = matchParts.length ? `<span class="match-score">${matchParts.join(' · ')}</span>` : ''

    return `
      <div class="row-card job-card" style="flex-direction:column; align-items:stretch;" data-job-id="${job.id}">
        <div class="job-card-header" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${job.title}</p>
            <p class="meta">${job.companies?.company_name || ''} · ${job.location}${job.is_remote ? ' (Remote)' : ''}</p>
            <p class="sub-meta">${job.slots_available} slot(s) available${matchLine ? ` · ${matchLine}` : ''}</p>
          </div>
          <div class="row-actions">
            ${applied ? '<span class="badge badge-info">Already Applied</span>' : ''}
            <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide details ▲' : 'View details ▼'}</span>
          </div>
        </div>
        ${
          expanded
            ? `
        <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);" class="job-details">
          <p style="font-size:14px; line-height:1.6; color:var(--gray-700); margin:0 0 16px;">${job.description || 'No description provided.'}</p>
          <p class="sub-meta" style="margin-bottom:8px; font-weight:700;">Required skills</p>
          <div style="margin-bottom:16px;">${skillChips(job, matchedSkillsLower)}</div>
          <p class="sub-meta" style="margin-bottom:16px;"><strong>Eligible programs:</strong> ${programNames(job.eligible_programs)}</p>
          ${
            applied
              ? '<p class="empty-text">You\'ve already applied to this posting.</p>'
              : `
          <div class="field">
            <label>Resume ${hasProfileResume ? '' : '(required to apply)'}</label>
            <input type="file" class="resume-input" accept=".pdf,.doc,.docx" ${hasProfileResume ? '' : 'required'} />
          </div>
          <div class="field">
            <label>Referral Letter (optional)</label>
            <input type="file" class="referral-input" accept=".pdf,.doc,.docx" />
          </div>
          <p class="form-error apply-error" style="display:none;"></p>
          <button class="btn btn-primary btn-sm submit-apply-btn" data-job-id="${job.id}" ${hasProfileResume ? '' : 'disabled'}>Submit Application</button>
          `
          }
        </div>`
            : ''
        }
      </div>`
  }

  function renderLists() {
    matchedList.innerHTML = matchedJobs.length
      ? matchedJobs.map(({ job, info }) => renderJobCard(job, info)).join('')
      : matchedList.innerHTML // keep the empty-state message already set above

    browseList.innerHTML = allJobs.length
      ? allJobs.map((job) => renderJobCard(job, null)).join('')
      : '<p class="empty-text">No open postings right now — check back soon.</p>'

    document.querySelectorAll('.job-card-header').forEach((header) => {
      header.addEventListener('click', () => {
        const jobId = header.closest('.job-card').dataset.jobId
        expandedJobId = expandedJobId === jobId ? null : jobId
        renderLists()
      })
    })

    document.querySelectorAll('.submit-apply-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        submitApplication(btn.dataset.jobId, btn)
      })
    })

    // Submit stays disabled until a resume file is actually chosen (unless
    // one is already on file from the student's profile).
    document.querySelectorAll('.resume-input').forEach((input) => {
      input.addEventListener('click', (e) => e.stopPropagation())
      input.addEventListener('change', () => {
        const card = input.closest('.job-card')
        const submitBtn = card.querySelector('.submit-apply-btn')
        if (submitBtn) submitBtn.disabled = !input.files[0] && !hasProfileResume
      })
    })
    document.querySelectorAll('.referral-input').forEach((input) => {
      input.addEventListener('click', (e) => e.stopPropagation())
    })

    // Prevent other inputs inside the expanded panel from toggling the card closed.
    document.querySelectorAll('.job-details').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation())
    })
  }

  async function submitApplication(jobPostingId, btn) {
    const card = btn.closest('.job-card')
    const errorEl = card.querySelector('.apply-error')
    const resumeFile = card.querySelector('.resume-input')?.files[0]
    const referralFile = card.querySelector('.referral-input')?.files[0]

    errorEl.style.display = 'none'

    if (!resumeFile && !hasProfileResume) {
      errorEl.textContent = 'Please attach a resume before submitting.'
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
      renderLists()
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Submit Application'
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    }
  }

  renderLists()
}
