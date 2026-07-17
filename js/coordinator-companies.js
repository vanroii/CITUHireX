import { supabase } from '../js/supabase-client.js'
import { requireRole } from '../js/auth.js'
import { renderSidebar } from '../js/sidebar.js'

const STATUS_BADGE = {
  verified: '<span class="badge badge-success">Verified</span>',
  denied: '<span class="badge badge-warn">Denied</span>',
  pending: '<span class="badge badge-info">Pending Review</span>',
}

const auth = await requireRole('coordinator')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: 'coordinator', activePage: 'companies.html', profile })

  let companies = []
  let expandedId = null

  async function load() {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    companies = data || []
    render()
  }

  function render() {
    const list = document.getElementById('companies-list')
    list.innerHTML = companies.length
      ? companies.map((c) => renderCard(c)).join('')
      : '<p class="empty-text">No companies registered yet.</p>'

    list.querySelectorAll('.company-header').forEach((header) => {
      header.addEventListener('click', () => {
        const id = header.closest('.company-card').dataset.id
        expandedId = expandedId === id ? null : id
        render()
      })
    })

    list.querySelectorAll('.company-details').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation()))

    list.querySelectorAll('.set-status-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const status = btn.dataset.status
        btn.disabled = true
        await supabase
          .from('companies')
          .update({
            verification_status: status,
            is_verified: status === 'verified',
            verified_by: profile.id,
            verified_at: new Date().toISOString(),
          })
          .eq('profile_id', btn.dataset.id)
        load()
      })
    })
  }

  function renderCard(c) {
    const expanded = expandedId === c.profile_id
    const status = c.verification_status || 'pending'

    return `
      <div class="row-card company-card" style="flex-direction:column; align-items:stretch;" data-id="${c.profile_id}">
        <div class="company-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>
            <p class="title">${c.company_name}</p>
            <p class="meta">${c.industry || ''} · ${c.address || ''}</p>
          </div>
          <div class="row-actions">
            ${STATUS_BADGE[status] || ''}
            <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide ▲' : 'View details ▼'}</span>
          </div>
        </div>
        ${expanded ? renderDetails(c, status) : ''}
      </div>`
  }

  function renderDetails(c, status) {
    return `
      <div class="company-details" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Industry</p><p class="sub-meta" style="margin:0;">${c.industry || '—'}</p></div>
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Address</p><p class="sub-meta" style="margin:0;">${c.address || '—'}</p></div>
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Website</p><p class="sub-meta" style="margin:0;">${c.website || '—'}</p></div>
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Contact Person</p><p class="sub-meta" style="margin:0;">${c.contact_person || '—'}</p></div>
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Registered</p><p class="sub-meta" style="margin:0;">${new Date(c.created_at).toLocaleDateString()}</p></div>
          <div><p class="sub-meta" style="font-weight:700; margin:0 0 2px;">Status</p><p class="sub-meta" style="margin:0;">${STATUS_BADGE[status] || status}</p></div>
        </div>
        <div class="row-actions">
          <a href="messages.html?with=${c.profile_id}" class="btn btn-ghost btn-sm">💬 Message</a>
          ${status !== 'verified' ? `<button class="btn btn-primary btn-sm set-status-btn" data-id="${c.profile_id}" data-status="verified">Verify</button>` : ''}
          ${status !== 'denied' ? `<button class="btn btn-ghost btn-sm set-status-btn" data-id="${c.profile_id}" data-status="denied">Deny</button>` : ''}
          ${status !== 'pending' ? `<button class="btn btn-ghost btn-sm set-status-btn" data-id="${c.profile_id}" data-status="pending">Reset to Pending</button>` : ''}
        </div>
      </div>`
  }

  load()
}
