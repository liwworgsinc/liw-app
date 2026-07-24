(function createLiwHelpers() {
  'use strict';

  const db = window.liwSupabase;

  const statusLabels = {
    draft: 'Draft',
    submitted: 'Submitted',
    contacted: 'Contacted',
    documents_needed: 'Documents Needed',
    appointment_scheduled: 'Appointment Scheduled',
    payment_due: 'Payment Due',
    in_progress: 'In Progress',
    completed: 'Completed',
    closed: 'Closed',
    sent: 'Sent',
    partial: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
    void: 'Void',
    pending: 'Pending',
    succeeded: 'Succeeded',
    failed: 'Failed',
    refunded: 'Refunded',
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    no_show: 'No Show'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', includeTime
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
    ).format(date);
  }

  function formatMoney(cents) {
    const amount = Number(cents || 0) / 100;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function statusBadge(status) {
    const safeStatus = String(status || 'draft').replace(/[^a-z_]/g, '');
    return `<span class="status-badge status-${safeStatus}">${escapeHtml(statusLabels[safeStatus] || safeStatus.replaceAll('_', ' '))}</span>`;
  }

  function setLoading(show, message = 'Working…') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const messageNode = overlay.querySelector('[data-loading-message]');
    if (messageNode) messageNode.textContent = message;
    overlay.classList.toggle('show', Boolean(show));
    overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
    document.body.classList.toggle('is-loading', Boolean(show));
  }

  function notify(icon, title, text = '') {
    // Always remove the full-screen loading layer before opening a dialog.
    // The loading layer uses a high z-index and can otherwise block SweetAlert buttons.
    setLoading(false);
    if (window.Swal) {
      return window.Swal.fire({ icon, title, text, confirmButtonColor: '#263fa4' });
    }
    window.alert([title, text].filter(Boolean).join('\n'));
    return Promise.resolve();
  }

  function toast(icon, title) {
    if (!window.Swal) return;
    window.Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true
    });
  }

  async function getUser() {
    if (!db) return null;
    const { data, error } = await db.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function getRole(userId) {
    if (!db || !userId) return 'customer';
    const { data, error } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('Unable to read user role:', error);
      return 'customer';
    }
    return data?.role || 'customer';
  }

  function safeRedirectTarget(fallback = 'portal.html') {
    const requested = new URLSearchParams(window.location.search).get('redirect');
    if (!requested) return fallback;
    const match = requested.match(/^(portal|intake|admin|index)\.html(?:\?service=([a-z0-9-]+))?$/);
    if (!match) return fallback;
    if (match[1] !== 'intake' && match[2]) return fallback;
    const allowedServices = new Set(['real-estate','property-management','tax-preparation','credit-solutions','business-loans','business-advertising','web-design','eyeglasses-repair','digital-business-cards']);
    if (match[2] && !allowedServices.has(match[2])) return fallback;
    return requested;
  }

  async function requireAuth(options = {}) {
    const user = await getUser();
    if (!user) {
      const currentFile = window.location.pathname.split('/').pop() || 'portal.html';
      const current = `${currentFile}${window.location.search || ''}`;
      window.location.replace(`login.html?redirect=${encodeURIComponent(current)}`);
      return null;
    }
    if (options.staffOnly) {
      const role = await getRole(user.id);
      if (!['staff', 'admin', 'owner'].includes(role)) {
        await notify('error', 'Access denied', 'This area is for LIW staff only.');
        window.location.replace('portal.html');
        return null;
      }
      return { user, role };
    }
    return { user, role: await getRole(user.id) };
  }

  async function signOut() {
    if (!db) return;
    setLoading(true, 'Signing out…');
    await db.auth.signOut();
    window.location.replace('index.html');
  }

  async function refreshNavigation() {
    const user = await getUser();
    document.querySelectorAll('[data-auth="guest"]').forEach((node) => node.classList.toggle('d-none', Boolean(user)));
    document.querySelectorAll('[data-auth="user"]').forEach((node) => node.classList.toggle('d-none', !user));
    if (user) {
      const role = await getRole(user.id);
      document.querySelectorAll('[data-auth="staff"]').forEach((node) => node.classList.toggle('d-none', !['staff', 'admin', 'owner'].includes(role)));
      document.querySelectorAll('[data-user-email]').forEach((node) => { node.textContent = user.email || ''; });
    }
  }

  function detailRows(details) {
    if (!details || typeof details !== 'object') return '<p class="text-muted mb-0">No additional details.</p>';
    const rows = Object.entries(details).filter(([, value]) => value !== '' && value !== null && value !== undefined);
    if (!rows.length) return '<p class="text-muted mb-0">No additional details.</p>';
    return `<dl class="detail-list mb-0">${rows.map(([key, value]) => {
      const label = key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</dd>`;
    }).join('')}</dl>`;
  }

  function requestNumber(value) {
    return `LIW-${String(value || 0).padStart(6, '0')}`;
  }

  function ensureLegalLinks() {
    if (document.querySelector('[data-legal-links]')) return;
    const footer = document.createElement('footer');
    footer.className = 'legal-strip';
    footer.setAttribute('data-legal-links', '');
    footer.innerHTML = `<div class="container d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2"><span>&copy; ${new Date().getFullYear()} LIW Worgs Inc.</span><span><a href="terms.html">Terms of Use</a><span class="mx-2" aria-hidden="true">|</span><a href="privacy.html">Privacy Policy</a><span class="mx-2" aria-hidden="true">|</span><a href="tel:+19292342881">929-234-2881</a></span></div>`;
    document.body.appendChild(footer);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-signout]').forEach((button) => button.addEventListener('click', signOut));
    ensureLegalLinks();
    refreshNavigation();
  });

  window.LIW = Object.freeze({
    db,
    escapeHtml,
    formatDate,
    formatMoney,
    statusBadge,
    statusLabels,
    setLoading,
    notify,
    toast,
    getUser,
    getRole,
    safeRedirectTarget,
    requireAuth,
    signOut,
    refreshNavigation,
    detailRows,
    requestNumber
  });
})();
