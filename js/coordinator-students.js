import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'students.html', profile })

  // RLS (migration 0023) already scopes this to the coordinator's
  // assigned_programs — no client-side filtering needed for that part.
  const { data: students } = await supabase
    .from('students')
    .select('profile_id, student_number, year_level, profiles(full_name, email), programs(name)')
    .order('created_at', { ascending: false })

  const all = students || []
  const table = document.getElementById('students-table')
  const GRID = '1.4fr 1fr 1.6fr 1.4fr 0.8fr 0.9fr'

  function render(items) {
    table.innerHTML = `
      <div class="thead-row" style="grid-template-columns: ${GRID};">
        <span>Name</span><span>Student No.</span><span>Email</span><span>Program</span><span>Year</span><span></span>
      </div>
      ${
        items.length
          ? items
              .map(
                (s) => `
        <div class="trow" style="grid-template-columns: ${GRID};">
          <span style="font-weight:600;">${s.profiles?.full_name || ''}</span>
          <span>${s.student_number}</span>
          <span>${s.profiles?.email || ''}</span>
          <span>${s.programs?.name || ''}</span>
          <span>Year ${s.year_level}</span>
          <span><a href="messages.html?with=${s.profile_id}" class="btn btn-ghost btn-sm">💬</a></span>
        </div>`
              )
              .join('')
          : '<p class="empty">No students found.</p>'
      }
    `
  }

  document.getElementById('search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase()
    render(
      all.filter(
        (s) =>
          (s.profiles?.full_name || '').toLowerCase().includes(q) ||
          (s.student_number || '').toLowerCase().includes(q) ||
          (s.profiles?.email || '').toLowerCase().includes(q)
      )
    )
  })

  render(all)
}
