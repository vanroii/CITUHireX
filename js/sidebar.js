import { signOut } from './auth.js'
import { supabase } from './supabase-client.js'

const NAV_ITEMS = {
  student: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'jobs.html', icon: '🔎', label: 'Browse Jobs' },
    { href: 'applications.html', icon: '📄', label: 'My Applications' },
    { href: 'profile.html', icon: '👤', label: 'My Profile' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
    { href: 'notifications.html', icon: '🔔', label: 'Notifications' },
  ],
  company: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'jobs.html', icon: '💼', label: 'My Job Postings' },
    { href: 'applicants.html', icon: '📋', label: 'Applicants' },
    { href: 'profile.html', icon: '🏢', label: 'Company Profile' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
    { href: 'notifications.html', icon: '🔔', label: 'Notifications' },
  ],
  coordinator: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'approvals.html', icon: '✅', label: 'Approval Queue' },
    { href: 'students.html', icon: '🎓', label: 'Students' },
    { href: 'companies.html', icon: '🏢', label: 'Companies' },
    { href: 'analytics.html', icon: '📊', label: 'Analytics' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
    { href: 'notifications.html', icon: '🔔', label: 'Notifications' },
  ],
}

const ROLE_LABEL = {
  student: 'Student',
  company: 'Partner Company',
  coordinator: 'OJT Coordinator',
}

/**
 * Renders the sidebar into #sidebar-root. Call after requireRole() resolves.
 * `activePage` should match one of the `href` values above (e.g. 'jobs.html').
 */
export function renderSidebar({ role, activePage, profile }) {
  const root = document.getElementById('sidebar-root')
  if (!root) return

  const items = NAV_ITEMS[role] || []

  root.innerHTML = `
    <aside class="sidebar">
      <div class="logo-row">
        <span class="logo-dot"></span>
        <span class="logo-text">CITUHireX</span>
      </div>
      ${items
        .map(
          (item) => `
        <a class="nav-item ${item.href === activePage ? 'active' : ''}" href="${item.href}" data-nav-href="${item.href}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
          ${item.href === 'messages.html' ? '<span class="nav-badge" id="msg-badge" style="display:none;"></span>' : ''}
          ${item.href === 'notifications.html' ? '<span class="nav-badge" id="notif-badge" style="display:none;"></span>' : ''}
        </a>`
        )
        .join('')}
      <div class="sidebar-footer">
        <p class="who">${profile?.full_name || ''} · ${ROLE_LABEL[role] || role}</p>
        <button id="signout-btn" type="button">Log out</button>
      </div>
    </aside>
  `

  document.getElementById('signout-btn').addEventListener('click', () => signOut('..'))

  if (profile?.id) {
    wireNotificationBadge(profile.id)
    wireMessageBadge(profile.id)
  }
}

async function wireMessageBadge(userId) {
  const badge = document.getElementById('msg-badge')
  if (!badge) return

  async function refreshCount() {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .is('read_at', null)

    if (count && count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count)
      badge.style.display = 'inline-flex'
    } else {
      badge.style.display = 'none'
    }
  }

  refreshCount()

  supabase
    .channel(`msg-badge-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
      refreshCount
    )
    .subscribe()
}

async function wireNotificationBadge(userId) {
  const badge = document.getElementById('notif-badge')
  if (!badge) return

  async function refreshCount() {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (count && count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count)
      badge.style.display = 'inline-flex'
    } else {
      badge.style.display = 'none'
    }
  }

  refreshCount()

  supabase
    .channel(`notif-badge-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      refreshCount
    )
    .subscribe()
}
