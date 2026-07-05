import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'students.html', profile })

  const { data: students } = await supabase
    .from('students')
    .select('*, profiles(full_name, email), programs(name)')
    .order('created_at', { ascending: false })

  const all = students || []
  const table = document.getElementById('students-table')

  function render(items) {
    table.innerHTML = `
      <div class="thead-row" style="grid-template-columns: 1.6fr 1.2fr 1.6fr 0.8fr 1fr;">
        <span>Name</span><span>Student No.</span><span>Program</span><span>Year</span><span>Hours</span>
      </div>
      ${
        items.length
          ? items
              .map(
                (s) => `
        <div class="trow" style="grid-template-columns: 1.6fr 1.2fr 1.6fr 0.8fr 1fr;">
          <span style="font-weight:600;">${s.profiles?.full_name || ''}</span>
          <span>${s.student_number}</span>
          <span>${s.programs?.name || ''}</span>
          <span>Year ${s.year_level}</span>
          <span>${s.completed_hours}</span>
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
          (s.student_number || '').toLowerCase().includes(q)
      )
    )
  })

  render(all)
}
