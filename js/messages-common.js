import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderSidebar } from './sidebar.js'

const auth = await requireAuth('..')
if (auth) {
  const { profile } = auth
  renderSidebar({ role: profile.role, activePage: 'messages.html', profile })

  const contactsEl = document.getElementById('contacts-list')
  const threadEl = document.getElementById('thread-panel')

  let activeContactId = null
  let contacts = [] // [{ id, full_name, lastBody, lastAt, unread }]

  async function loadContacts() {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, body, sent_at, read_at')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('sent_at', { ascending: false })

    const byPartner = new Map()
    ;(msgs || []).forEach((m) => {
      const partnerId = m.sender_id === profile.id ? m.receiver_id : m.sender_id
      if (!byPartner.has(partnerId)) {
        byPartner.set(partnerId, { id: partnerId, lastBody: m.body, lastAt: m.sent_at, unread: false })
      }
      // Unread = any message FROM them TO me that hasn't been read yet.
      if (m.receiver_id === profile.id && m.sender_id === partnerId && !m.read_at) {
        byPartner.get(partnerId).unread = true
      }
    })

    const partnerIds = [...byPartner.keys()]

    // If arriving via a "Message" deep link (?with=<uuid>) for someone with
    // no existing conversation yet, include them as a contact with 0 messages
    // so a first message can actually be sent and their name still shows.
    const params = new URLSearchParams(window.location.search)
    const deepLinkId = params.get('with')
    if (deepLinkId && !byPartner.has(deepLinkId)) {
      byPartner.set(deepLinkId, { id: deepLinkId, lastBody: 'Start a conversation…', lastAt: null, unread: false })
      partnerIds.push(deepLinkId)
    }

    if (partnerIds.length === 0) {
      contacts = []
      renderContacts()
      return
    }

    const { data: partnerProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', partnerIds)

    contacts = partnerIds
      .map((id) => {
        const p = (partnerProfiles || []).find((pp) => pp.id === id)
        const meta = byPartner.get(id)
        return { id, full_name: p?.full_name || 'Unknown', role: p?.role, ...meta }
      })
      // Most recent conversation first; brand-new (no messages yet) contacts float to top too.
      .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))

    renderContacts()

    if (deepLinkId && !activeContactId) {
      openThread(deepLinkId)
    }
  }

  function renderContacts() {
    contactsEl.innerHTML = contacts.length
      ? contacts
          .map(
            (c) => `
      <div class="msg-contact ${c.id === activeContactId ? 'active' : ''}" data-id="${c.id}">
        <p class="name">${c.full_name}${c.unread ? ' <span class="msg-unread-dot"></span>' : ''}</p>
        <p class="preview">${c.lastBody || ''}</p>
      </div>`
          )
          .join('')
      : '<p class="empty-text" style="padding:12px;">No conversations yet.</p>'

    contactsEl.querySelectorAll('.msg-contact').forEach((el) => {
      el.addEventListener('click', () => openThread(el.dataset.id))
    })
  }

  async function openThread(partnerId) {
    activeContactId = partnerId
    renderContacts()

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${profile.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${profile.id})`
      )
      .order('sent_at', { ascending: true })

    threadEl.innerHTML = `
      <div class="msg-scroll" id="msg-scroll"></div>
      <div class="msg-input-row">
        <input type="text" id="msg-input" placeholder="Type a message…" />
        <button class="btn btn-primary btn-sm" id="send-btn">Send</button>
      </div>
    `
    renderMessages(msgs || [])

    document.getElementById('send-btn').addEventListener('click', sendMessage)
    document.getElementById('msg-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage()
    })

    // Mark any messages they sent me as read now that I've opened the thread.
    const unreadIds = (msgs || [])
      .filter((m) => m.receiver_id === profile.id && m.sender_id === partnerId && !m.read_at)
      .map((m) => m.id)
    if (unreadIds.length) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      const contact = contacts.find((c) => c.id === partnerId)
      if (contact) contact.unread = false
      renderContacts()
    }
  }

  function renderMessages(msgs) {
    const scroll = document.getElementById('msg-scroll')
    if (!scroll) return
    scroll.innerHTML = msgs.length
      ? msgs
          .map(
            (m) => `<div class="msg-bubble ${m.sender_id === profile.id ? 'mine' : 'theirs'}">${escapeHtml(m.body)}</div>`
          )
          .join('')
      : '<p class="empty-text" style="padding:16px;">No messages yet — say hello!</p>'
    scroll.scrollTop = scroll.scrollHeight
  }

  async function sendMessage() {
    const input = document.getElementById('msg-input')
    const body = input.value.trim()
    if (!body || !activeContactId) return

    input.value = ''
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: activeContactId,
      body,
    })
    if (!error) {
      openThread(activeContactId)
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  // Realtime: refresh the open thread (and contact list) when a relevant message arrives.
  supabase
    .channel(`messages-live-${profile.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const m = payload.new
        if (m.sender_id !== profile.id && m.receiver_id !== profile.id) return
        loadContacts()
        if (activeContactId && (m.sender_id === activeContactId || m.receiver_id === activeContactId)) {
          openThread(activeContactId)
        }
      }
    )
    .subscribe()

  loadContacts()
}
