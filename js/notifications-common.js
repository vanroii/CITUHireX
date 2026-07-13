import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderSidebar } from './sidebar.js'

const TYPE_ICON = {
  application_status_change: '📄',
  new_applicant: '🎓',
  job_approved: '✅',
}

const TYPE_LABEL = {
  application_status_change: 'Application Update',
  new_applicant: 'New Applicant',
  job_approved: 'Job Posting Approved',
}

// Where "View details" should send the person, based on notification type —
// scoped per role since the same type can mean different pages depending on
// who's looking at it.
function relatedLink(type, role) {
  if (type === 'application_status_change' && role === 'student') {
    return { href: 'applications.html', label: 'View My Applications' }
  }
  if (type === 'new_applicant' && role === 'company') {
    return { href: 'applicants.html', label: 'View Applicants' }
  }
  if (type === 'job_approved' && role === 'company') {
    return { href: 'jobs.html', label: 'View My Job Postings' }
  }
  return null
}

const auth = await requireAuth('..')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: profile.role, activePage: 'notifications.html', profile })

  const list = document.getElementById('notifications-list')
  const markAllBtn = document.getElementById('mark-all-read-btn')
  let notifications = []
  let expandedId = null

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    notifications = data || []
    render()
  }

  function render() {
    const unreadCount = notifications.filter((n) => !n.is_read).length
    markAllBtn.style.display = unreadCount > 0 ? 'inline-flex' : 'none'

    list.innerHTML = notifications.length
      ? notifications.map((n) => renderItem(n)).join('')
      : '<p class="empty-text">No notifications yet — you\'ll see updates on applications and messages here.</p>'

    list.querySelectorAll('.notif-header').forEach((el) => {
      el.addEventListener('click', () => toggleExpand(el.closest('.notif-item').dataset.id))
    })

    list.querySelectorAll('.notif-details').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation())
    })
  }

  function renderItem(n) {
    const icon = TYPE_ICON[n.type] || '🔔'
    const expanded = expandedId === n.id
    const shortWhen = new Date(n.created_at).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })

    return `
      <div class="row-card notif-item ${n.is_read ? '' : 'notif-unread'}" data-id="${n.id}" style="flex-direction:column; align-items:stretch;">
        <div class="notif-header" style="cursor:pointer; display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
          <div style="display:flex; gap:14px; align-items:flex-start;">
            <span style="font-size:20px;">${icon}</span>
            <div>
              <p class="title" style="margin:0 0 4px;">${n.title}</p>
              <p class="sub-meta" style="margin:0;">${shortWhen}</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
            ${n.is_read ? '' : '<span class="badge badge-info">New</span>'}
            <span style="font-size:13px; font-weight:600; color:var(--maroon);">${expanded ? 'Hide ▲' : 'View details ▼'}</span>
          </div>
        </div>
        ${expanded ? renderDetails(n, icon) : ''}
      </div>`
  }

  function renderDetails(n, icon) {
    const fullWhen = new Date(n.created_at).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    const link = relatedLink(n.type, profile.role)

    return `
      <div class="notif-details" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--gray-200);">
        <p style="font-size:14px; line-height:1.6; color:var(--gray-700); margin:0 0 16px;">${n.body || 'No additional details.'}</p>
        <div style="display:flex; flex-wrap:wrap; gap:20px; margin-bottom:16px;">
          <div>
            <p class="sub-meta" style="margin:0 0 2px; font-weight:700;">Type</p>
            <p class="sub-meta" style="margin:0;">${icon} ${TYPE_LABEL[n.type] || n.type}</p>
          </div>
          <div>
            <p class="sub-meta" style="margin:0 0 2px; font-weight:700;">Received</p>
            <p class="sub-meta" style="margin:0;">${fullWhen}</p>
          </div>
          <div>
            <p class="sub-meta" style="margin:0 0 2px; font-weight:700;">Status</p>
            <p class="sub-meta" style="margin:0;">${n.is_read ? 'Read' : 'Unread'}</p>
          </div>
        </div>
        ${link ? `<a href="${link.href}" class="btn btn-primary btn-sm">${link.label}</a>` : ''}
      </div>`
  }

  async function toggleExpand(id) {
    expandedId = expandedId === id ? null : id
    render()
    if (expandedId === id) await markRead(id)
  }

  async function markRead(id) {
    const n = notifications.find((x) => x.id === id)
    if (!n || n.is_read) return
    n.is_read = true
    render()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  markAllBtn.addEventListener('click', async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    notifications.forEach((n) => (n.is_read = true))
    render()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
  })

  // Realtime: new notifications appear live without a refresh.
  supabase
    .channel(`notifications-${profile.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
      (payload) => {
        notifications.unshift(payload.new)
        render()
      }
    )
    .subscribe()

  load()
}
