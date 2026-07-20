// A small in-app confirmation modal, used instead of the browser's native
// confirm() so the prompt looks and feels like part of CITUHireX rather than
// a generic OS dialog. Injects its markup once, then reuses it.
//
// Usage: const ok = await confirmDialog('Delete this?', 'This cannot be undone.')
// if (ok) { ...proceed... }

let overlay = null

function ensureModal() {
  if (overlay) return overlay

  overlay = document.createElement('div')
  overlay.id = 'confirm-modal-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(20,16,15,0.55);
    display: none; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px;
  `
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:16px; max-width:420px; width:100%; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,0.25);">
      <p id="confirm-modal-title" style="font-size:18px; font-weight:800; margin:0 0 8px; color:var(--ink);"></p>
      <p id="confirm-modal-message" style="font-size:14px; color:var(--gray-700); line-height:1.5; margin:0 0 24px;"></p>
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button id="confirm-modal-cancel" class="btn btn-ghost btn-sm" type="button">Cancel</button>
        <button id="confirm-modal-confirm" class="btn btn-primary btn-sm" type="button">Confirm</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  return overlay
}

export function confirmDialog(title, message, confirmLabel = 'Confirm') {
  const modal = ensureModal()
  modal.querySelector('#confirm-modal-title').textContent = title
  modal.querySelector('#confirm-modal-message').textContent = message
  const confirmBtn = modal.querySelector('#confirm-modal-confirm')
  const cancelBtn = modal.querySelector('#confirm-modal-cancel')
  confirmBtn.textContent = confirmLabel

  modal.style.display = 'flex'

  return new Promise((resolve) => {
    function cleanup(result) {
      modal.style.display = 'none'
      confirmBtn.removeEventListener('click', onConfirm)
      cancelBtn.removeEventListener('click', onCancel)
      modal.removeEventListener('click', onOverlayClick)
      document.removeEventListener('keydown', onKeydown)
      resolve(result)
    }
    function onConfirm() { cleanup(true) }
    function onCancel() { cleanup(false) }
    function onOverlayClick(e) { if (e.target === modal) cleanup(false) }
    function onKeydown(e) { if (e.key === 'Escape') cleanup(false) }

    confirmBtn.addEventListener('click', onConfirm)
    cancelBtn.addEventListener('click', onCancel)
    modal.addEventListener('click', onOverlayClick)
    document.addEventListener('keydown', onKeydown)
  })
}
