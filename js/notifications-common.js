import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderSidebar } from './sidebar.js'

const TYPE_ICON = {
  application_status_change: '📄',
  new_applicant: '🎓',
  job_approved: '✅',
}

const auth = await requireAuth('..')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: profile.role, activePage: 'notifications.html', profile })

  const list = document.getElementById('notifications-list')
  const markAllBtn = document.getElementById('mark-all-read-btn')
  let notifications = []

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

    list.querySelectorAll('.notif-item').forEach((el) => {
      el.addEventListener('click', () => markRead(el.dataset.id))
    })
  }

  function renderItem(n) {
    const icon = TYPE_ICON[n.type] || '🔔'
    const when = new Date(n.created_at).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    return `
      <div class="row-card notif-item ${n.is_read ? '' : 'notif-unread'}" data-id="${n.id}" style="cursor:pointer; gap:16px;">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          <span style="font-size:20px;">${icon}</span>
          <div>
            <p class="title" style="margin:0 0 4px;">${n.title}</p>
            <p class="meta" style="margin:0;">${n.body || ''}</p>
            <p class="sub-meta" style="margin:4px 0 0;">${when}</p>
          </div>
        </div>
        ${n.is_read ? '' : '<span class="badge badge-info">New</span>'}
      </div>`
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
