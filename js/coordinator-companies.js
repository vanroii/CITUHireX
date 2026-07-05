import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'companies.html', profile })

  async function load() {
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })

    const list = document.getElementById('companies-list')
    const items = companies || []

    list.innerHTML = items.length
      ? items
          .map(
            (c) => `
      <div class="row-card">
        <div>
          <p class="title">${c.company_name}</p>
          <p class="meta">${c.industry || ''} · ${c.address || ''}</p>
          <p class="sub-meta">Contact: ${c.contact_person || '—'}</p>
        </div>
        <div class="row-actions">
          ${
            c.is_verified
              ? '<span class="badge badge-success">Verified</span>'
              : `<button class="btn btn-primary btn-sm verify-btn" data-id="${c.profile_id}">Verify</button>`
          }
        </div>
      </div>`
          )
          .join('')
      : '<p class="empty-text">No companies registered yet.</p>'

    list.querySelectorAll('.verify-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        btn.textContent = 'Verifying…'
        await supabase
          .from('companies')
          .update({ is_verified: true, verified_by: profile.id, verified_at: new Date().toISOString() })
          .eq('profile_id', btn.dataset.id)
        load()
      })
    })
  }

  load()
}
