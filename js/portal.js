(function portalPage() {
  'use strict';

  const LIW = window.LIW;
  let user = null;
  let role = 'customer';
  let services = [];
  let requests = [];
  let documents = [];
  let appointments = [];
  let invoices = [];
  let payments = [];
  let messages = [];

  const serviceName = (id) => services.find((service) => service.id === id)?.name || 'LIW Service';
  const requestFor = (id) => requests.find((request) => request.id === id) || null;
  const invoiceNumber = (invoice) => `INV-${String(invoice?.invoice_number || 0).padStart(6, '0')}`;
  const paidForInvoice = (invoiceId) => payments.filter((payment) => payment.invoice_id === invoiceId && payment.status === 'succeeded').reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);
  const balanceForInvoice = (invoice) => Math.max(Number(invoice.total_cents || 0) - paidForInvoice(invoice.id), 0);
  const canPayInvoice = (invoice) => balanceForInvoice(invoice) > 0 && ['sent', 'partial', 'overdue'].includes(invoice.status);

  function showTab(target) {
    const trigger = document.querySelector(`[data-bs-target="${target}"]`);
    if (trigger && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(trigger).show();
  }

  function renderStats() {
    document.getElementById('statRequests').textContent = requests.length;
    document.getElementById('statActive').textContent = requests.filter((item) => !['completed', 'closed'].includes(item.status)).length;
    document.getElementById('statAppointments').textContent = appointments.filter((item) => !['cancelled', 'completed', 'no_show'].includes(item.status)).length;
    document.getElementById('statBalance').textContent = LIW.formatMoney(invoices.reduce((sum, invoice) => sum + (['paid', 'void'].includes(invoice.status) ? 0 : balanceForInvoice(invoice)), 0));
  }

  function renderRequests() {
    const body = document.getElementById('requestsTableBody');
    const empty = document.getElementById('requestsEmpty');
    empty.classList.toggle('d-none', requests.length > 0);
    body.innerHTML = requests.map((request) => `<tr><td class="fw-bold">${LIW.requestNumber(request.request_number)}</td><td>${LIW.escapeHtml(serviceName(request.service_id))}</td><td>${LIW.escapeHtml(request.subject)}</td><td>${LIW.statusBadge(request.status)}</td><td>${LIW.formatDate(request.created_at)}</td><td><button class="btn btn-sm btn-outline-liw" data-request-view="${request.id}">View</button></td></tr>`).join('');
  }

  function renderDocuments() {
    const body = document.getElementById('documentsTableBody');
    const empty = document.getElementById('documentsEmpty');
    empty.classList.toggle('d-none', documents.length > 0);
    body.innerHTML = documents.map((item) => `<tr><td class="fw-semibold">${LIW.escapeHtml(item.file_name)}</td><td>${LIW.escapeHtml(item.category)}</td><td>${LIW.statusBadge(item.status)}</td><td>${LIW.formatDate(item.created_at)}</td><td><button class="btn btn-sm btn-outline-secondary" data-document-open="${item.id}"><i class="bi bi-box-arrow-up-right"></i> Open</button></td></tr>`).join('');
  }

  function renderAppointments() {
    const body = document.getElementById('appointmentsTableBody');
    const empty = document.getElementById('appointmentsEmpty');
    empty.classList.toggle('d-none', appointments.length > 0);
    body.innerHTML = appointments.map((appointment) => `<tr><td>${LIW.formatDate(appointment.starts_at, true)}</td><td class="text-capitalize">${LIW.escapeHtml(appointment.appointment_type.replaceAll('_', ' '))}</td><td>${LIW.escapeHtml(appointment.location || 'To be confirmed')}</td><td>${LIW.statusBadge(appointment.status)}</td></tr>`).join('');
  }

  function renderInvoices() {
    const body = document.getElementById('invoicesTableBody');
    const empty = document.getElementById('invoicesEmpty');
    empty.classList.toggle('d-none', invoices.length > 0);
    body.innerHTML = invoices.map((invoice) => {
      const balance = balanceForInvoice(invoice);
      const payButton = canPayInvoice(invoice) ? `<button class="btn btn-sm btn-liw invoice-pay-button" data-invoice-pay="${invoice.id}"><i class="bi bi-lock-fill me-1"></i>Pay ${LIW.formatMoney(balance)}</button>` : '';
      return `<tr><td class="fw-bold">${invoiceNumber(invoice)}</td><td>${LIW.formatMoney(invoice.total_cents)}</td><td class="fw-bold">${LIW.formatMoney(balance)}</td><td>${LIW.statusBadge(invoice.status)}</td><td>${LIW.formatDate(invoice.due_date)}</td><td class="text-nowrap"><button class="btn btn-sm btn-outline-liw me-1" data-invoice-view="${invoice.id}">View</button>${payButton}</td></tr>`;
    }).join('');
  }

  function renderMessages() {
    const thread = document.getElementById('portalMessageThread');
    const empty = document.getElementById('messagesEmpty');
    empty.classList.toggle('d-none', messages.length > 0);
    thread.classList.toggle('d-none', !messages.length);
    thread.innerHTML = messages.map((message) => {
      const request = requestFor(message.request_id);
      return `<article class="portal-message ${message.direction === 'staff_to_customer' ? 'incoming' : 'outgoing'}"><div class="portal-message-meta"><strong>${message.direction === 'staff_to_customer' ? 'LIW Worgs Inc.' : 'You'}</strong><span>${LIW.formatDate(message.created_at, true)}</span></div><h4>${LIW.escapeHtml(message.subject)}</h4><p>${LIW.escapeHtml(message.body)}</p>${request ? `<small>${LIW.requestNumber(request.request_number)} · ${LIW.escapeHtml(serviceName(request.service_id))}</small>` : ''}</article>`;
    }).join('');
    thread.scrollTop = thread.scrollHeight;
    const unread = messages.filter((message) => message.direction === 'staff_to_customer' && !message.read_at).length;
    const badge = document.getElementById('messageUnreadBadge');
    badge.textContent = unread;
    badge.classList.toggle('d-none', unread === 0);
  }

  function renderProfile(profile) {
    const form = document.getElementById('profileForm');
    form.full_name.value = profile?.full_name || '';
    form.email.value = profile?.email || user.email || '';
    form.phone.value = profile?.phone || '';
    form.company_name.value = profile?.company_name || '';
    form.preferred_contact.value = profile?.preferred_contact || 'email';
    document.querySelector('[data-portal-name]').textContent = profile?.full_name || user.email?.split('@')[0] || 'Client';
  }

  function populateRequestSelectors() {
    const options = requests.map((request) => `<option value="${request.id}">${LIW.requestNumber(request.request_number)} — ${LIW.escapeHtml(serviceName(request.service_id))}</option>`).join('');
    document.getElementById('documentRequest').innerHTML = '<option value="">General document</option>' + options;
    document.getElementById('messageRequest').innerHTML = requests.length ? options : '<option value="">No request available</option>';
  }

  async function loadDashboard() {
    LIW.setLoading(true, 'Loading your LIW portal…');
    try {
      const results = await Promise.all([
        LIW.db.from('service_catalog').select('id,name').eq('is_active', true).order('sort_order'),
        LIW.db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        LIW.db.from('service_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('appointments').select('*').eq('user_id', user.id).order('starts_at', { ascending: false }),
        LIW.db.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('portal_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      ]);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
      [services, , requests, appointments, invoices, payments, documents, messages] = results.map((result) => result.data || []);
      renderProfile(results[1].data);
      renderStats(); renderRequests(); renderDocuments(); renderAppointments(); renderInvoices(); renderMessages(); populateRequestSelectors();
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Unable to load portal', error.message || 'Please refresh the page.');
    } finally {
      LIW.setLoading(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    LIW.setLoading(true, 'Saving profile…');
    const { error } = await LIW.db.from('profiles').update({ full_name: form.full_name.value.trim(), phone: form.phone.value.trim(), company_name: form.company_name.value.trim(), preferred_contact: form.preferred_contact.value }).eq('id', user.id);
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to save profile', error.message);
    LIW.toast('success', 'Profile updated');
    document.querySelector('[data-portal-name]').textContent = form.full_name.value.trim() || 'Client';
  }

  async function uploadDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.document_file.files?.[0];
    if (!file) return LIW.notify('warning', 'Choose a file', 'Select a PDF, Word file, JPG, PNG, or WebP file.');
    if (file.size > 10 * 1024 * 1024) return LIW.notify('warning', 'File is too large', 'The maximum file size is 10 MB.');
    const requestId = form.request_id.value || null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${user.id}/${requestId || 'general'}/${crypto.randomUUID()}-${safeName}`;
    LIW.setLoading(true, 'Uploading document…');
    try {
      const { error: uploadError } = await LIW.db.storage.from('liw-documents').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: rowError } = await LIW.db.from('documents').insert({ request_id: requestId, user_id: user.id, file_name: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size, category: form.category.value.trim() || 'general' });
      if (rowError) { await LIW.db.storage.from('liw-documents').remove([path]); throw rowError; }
      form.reset(); LIW.toast('success', 'Document uploaded'); await loadDashboard();
    } catch (error) {
      console.error(error); await LIW.notify('error', 'Upload failed', error.message || 'Please try again.');
    } finally { LIW.setLoading(false); }
  }

  async function sendClientMessage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.request_id.value) return LIW.notify('warning', 'Choose a request', 'Messages must be connected to a service request.');
    LIW.setLoading(true, 'Sending secure message…');
    const { error } = await LIW.db.from('portal_messages').insert({ request_id: form.request_id.value, user_id: user.id, sender_id: user.id, direction: 'customer_to_staff', subject: form.subject.value.trim(), body: form.body.value.trim() });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Message not sent', error.message);
    form.subject.value = ''; form.body.value = '';
    LIW.toast('success', 'Message sent to LIW');
    await loadDashboard(); showTab('#messagesPane');
  }

  async function markMessagesRead() {
    const ids = messages.filter((message) => message.direction === 'staff_to_customer' && !message.read_at).map((message) => message.id);
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    const { error } = await LIW.db.from('portal_messages').update({ read_at: readAt }).in('id', ids);
    if (!error) { messages.forEach((message) => { if (ids.includes(message.id)) message.read_at = readAt; }); renderMessages(); }
  }

  async function openRequest(requestId) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;
    const { data: notes } = await LIW.db.from('request_notes').select('note,created_at').eq('request_id', request.id).eq('visible_to_customer', true).order('created_at', { ascending: false });
    const notesHtml = notes?.length ? notes.map((note) => `<div class="border rounded-3 p-2 mb-2"><small class="text-secondary">${LIW.formatDate(note.created_at, true)}</small><div>${LIW.escapeHtml(note.note)}</div></div>`).join('') : '<p class="text-muted mb-0">No customer updates yet.</p>';
    await window.Swal.fire({ title: LIW.requestNumber(request.request_number), html: `<div class="text-start"><p><strong>Service:</strong> ${LIW.escapeHtml(serviceName(request.service_id))}</p><p><strong>Subject:</strong> ${LIW.escapeHtml(request.subject)}</p><p><strong>Status:</strong> ${LIW.statusBadge(request.status)}</p><hr>${LIW.detailRows(request.details)}<hr><h6>Updates from LIW</h6>${notesHtml}</div>`, width: 720, confirmButtonColor: '#263fa4' });
  }

  async function openDocument(documentId) {
    const item = documents.find((documentItem) => documentItem.id === documentId);
    if (!item) return;
    LIW.setLoading(true, 'Opening document…');
    const { data, error } = await LIW.db.storage.from('liw-documents').createSignedUrl(item.storage_path, 120);
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to open document', error.message);
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function startInvoicePayment(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || !canPayInvoice(invoice)) return LIW.notify('info', 'No payment is due', 'This invoice does not currently have an online balance.');
    LIW.setLoading(true, 'Opening secure Stripe checkout…');
    try {
      const { data, error } = await LIW.db.functions.invoke('create-invoice-checkout', { body: { invoice_id: invoiceId } });
      if (error) {
        let message = error.message || 'Stripe Checkout is not available.';
        try { const payload = await error.context?.json(); message = payload?.error || payload?.message || message; } catch (_) { /* no-op */ }
        throw new Error(message);
      }
      if (!data?.url) throw new Error(data?.error || 'Stripe Checkout did not return a payment page.');
      window.location.assign(data.url);
    } catch (error) {
      console.error(error);
      LIW.setLoading(false);
      await LIW.notify('error', 'Unable to open payment', error.message || 'Please contact LIW for assistance.');
    }
  }

  async function openInvoice(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    LIW.setLoading(true, 'Loading invoice…');
    const { data: items, error } = await LIW.db.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order');
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to load invoice', error.message);
    const rows = (items || []).map((item) => `<tr><td>${LIW.escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${LIW.formatMoney(item.unit_price_cents)}</td><td class="text-end">${LIW.formatMoney(item.line_total_cents)}</td></tr>`).join('');
    const invoicePayments = payments.filter((payment) => payment.invoice_id === invoiceId && payment.status === 'succeeded');
    const paymentHtml = invoicePayments.length ? `<div class="payment-history-list">${invoicePayments.map((payment) => `<div class="payment-history-item"><span>${LIW.formatDate(payment.paid_at || payment.created_at, true)} · ${LIW.escapeHtml(payment.method)}</span><strong>${LIW.formatMoney(payment.amount_cents)}</strong></div>`).join('')}</div>` : '<p class="text-secondary">No successful payments recorded.</p>';
    const balance = balanceForInvoice(invoice);
    const result = await window.Swal.fire({ title: invoiceNumber(invoice), html: `<div class="text-start"><div class="d-flex justify-content-between align-items-center mb-3"><span>${LIW.statusBadge(invoice.status)}</span><div class="text-end"><small class="text-secondary d-block">Balance due</small><strong class="fs-3">${LIW.formatMoney(balance)}</strong></div></div><div class="table-responsive"><table class="table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th class="text-end">Total</th></tr></thead><tbody>${rows}</tbody></table></div><dl class="detail-list"><dt>Subtotal</dt><dd>${LIW.formatMoney(invoice.subtotal_cents)}</dd><dt>Discount</dt><dd>${LIW.formatMoney(invoice.discount_cents)}</dd><dt>Tax / fees</dt><dd>${LIW.formatMoney(invoice.tax_cents)}</dd><dt>Invoice total</dt><dd>${LIW.formatMoney(invoice.total_cents)}</dd><dt>Due date</dt><dd>${LIW.formatDate(invoice.due_date)}</dd></dl>${invoice.notes ? `<hr><p>${LIW.escapeHtml(invoice.notes)}</p>` : ''}<hr><h6>Payment history</h6>${paymentHtml}</div>`, width: 800, showCancelButton: canPayInvoice(invoice), confirmButtonText: canPayInvoice(invoice) ? `Pay ${LIW.formatMoney(balance)} securely` : 'Close', cancelButtonText: 'Close', confirmButtonColor: '#263fa4', reverseButtons: true });
    if (canPayInvoice(invoice) && result.isConfirmed) await startInvoicePayment(invoiceId);
  }

  function handlePaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');
    if (!status) return;
    const notice = document.getElementById('paymentNotice');
    if (status === 'success') {
      notice.className = 'payment-success-banner mb-4';
      notice.innerHTML = '<strong><i class="bi bi-check-circle-fill me-1"></i>Payment submitted successfully.</strong><div>Your invoice status and receipt record will update automatically after Stripe confirms the payment.</div>';
      showTab('#invoicesPane');
    } else if (status === 'cancelled') {
      notice.className = 'alert alert-warning mb-4';
      notice.innerHTML = '<strong>Payment was not completed.</strong> Your invoice remains open and can be paid when you are ready.';
      showTab('#invoicesPane');
    }
    history.replaceState({}, document.title, 'portal.html');
  }

  async function handleClick(event) {
    const requestButton = event.target.closest('[data-request-view]');
    if (requestButton) return openRequest(requestButton.dataset.requestView);
    const documentButton = event.target.closest('[data-document-open]');
    if (documentButton) return openDocument(documentButton.dataset.documentOpen);
    const invoiceView = event.target.closest('[data-invoice-view]');
    if (invoiceView) return openInvoice(invoiceView.dataset.invoiceView);
    const invoicePay = event.target.closest('[data-invoice-pay]');
    if (invoicePay) return startInvoicePayment(invoicePay.dataset.invoicePay);
  }

  async function init() {
    const auth = await LIW.requireAuth();
    if (!auth) return;
    user = auth.user; role = auth.role;
    document.querySelectorAll('[data-staff-link]').forEach((node) => node.classList.toggle('d-none', !['staff', 'admin', 'owner'].includes(role)));
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('documentForm').addEventListener('submit', uploadDocument);
    document.getElementById('clientMessageForm').addEventListener('submit', sendClientMessage);
    document.addEventListener('click', handleClick);
    document.querySelector('[data-bs-target="#messagesPane"]').addEventListener('shown.bs.tab', markMessagesRead);
    document.querySelectorAll('[data-open-tab]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showTab(link.dataset.openTab); document.querySelector(link.dataset.openTab)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    await loadDashboard();
    handlePaymentReturn();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
