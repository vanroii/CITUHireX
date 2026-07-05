import { signOut } from './auth.js'

const NAV_ITEMS = {
  student: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'jobs.html', icon: '🔎', label: 'Browse Jobs' },
    { href: 'applications.html', icon: '📄', label: 'My Applications' },
    { href: 'profile.html', icon: '👤', label: 'My Profile' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
  ],
  company: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'jobs.html', icon: '💼', label: 'My Job Postings' },
    { href: 'applicants.html', icon: '📋', label: 'Applicants' },
    { href: 'profile.html', icon: '🏢', label: 'Company Profile' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
  ],
  coordinator: [
    { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
    { href: 'approvals.html', icon: '✅', label: 'Approval Queue' },
    { href: 'students.html', icon: '🎓', label: 'Students' },
    { href: 'companies.html', icon: '🏢', label: 'Companies' },
    { href: 'analytics.html', icon: '📊', label: 'Analytics' },
    { href: 'messages.html', icon: '💬', label: 'Messages' },
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
        <a class="nav-item ${item.href === activePage ? 'active' : ''}" href="${item.href}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
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
}
