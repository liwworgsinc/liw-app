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
  let messages = [];

  const serviceName = (id) => services.find((service) => service.id === id)?.name || 'LIW Service';
  const requestFor = (id) => requests.find((request) => request.id === id) || null;

  function renderStats() {
    document.getElementById('statRequests').textContent = requests.length;
    document.getElementById('statActive').textContent = requests.filter((item) => !['completed', 'closed'].includes(item.status)).length;
    document.getElementById('statAppointments').textContent = appointments.filter((item) => !['cancelled', 'completed', 'no_show'].includes(item.status)).length;
    document.getElementById('statBalance').textContent = LIW.formatMoney(invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0));
  }

  function renderRequests() {
    const body = document.getElementById('requestsTableBody');
    const empty = document.getElementById('requestsEmpty');
    body.innerHTML = '';
    empty.classList.toggle('d-none', requests.length > 0);
    if (!requests.length) return;
    body.innerHTML = requests.map((request) => `<tr><td class="fw-bold">${LIW.requestNumber(request.request_number)}</td><td>${LIW.escapeHtml(serviceName(request.service_id))}</td><td>${LIW.escapeHtml(request.subject)}</td><td>${LIW.statusBadge(request.status)}</td><td>${LIW.formatDate(request.created_at)}</td><td><button class="btn btn-sm btn-outline-liw" data-request-view="${request.id}">View</button></td></tr>`).join('');
  }

  function renderDocuments() {
    const body = document.getElementById('documentsTableBody');
    const empty = document.getElementById('documentsEmpty');
    empty.classList.toggle('d-none', documents.length > 0);
    body.innerHTML = documents.map((documentItem) => `<tr><td class="fw-semibold">${LIW.escapeHtml(documentItem.file_name)}</td><td>${LIW.escapeHtml(documentItem.category)}</td><td>${LIW.statusBadge(documentItem.status)}</td><td>${LIW.formatDate(documentItem.created_at)}</td><td><button class="btn btn-sm btn-outline-secondary" data-document-open="${documentItem.id}"><i class="bi bi-box-arrow-up-right"></i> Open</button></td></tr>`).join('');
  }

  function renderAppointments() {
    const body = document.getElementById('appointmentsTableBody');
    const empty = document.getElementById('appointmentsEmpty');
    empty.classList.toggle('d-none', appointments.length > 0);
    body.innerHTML = appointments.map((appointment) => `<tr><td>${LIW.formatDate(appointment.starts_at, true)}</td><td>${LIW.escapeHtml(appointment.appointment_type.replaceAll('_', ' '))}</td><td>${LIW.escapeHtml(appointment.location || 'To be confirmed')}</td><td>${LIW.statusBadge(appointment.status)}</td></tr>`).join('');
  }

  function renderInvoices() {
    const body = document.getElementById('invoicesTableBody');
    const empty = document.getElementById('invoicesEmpty');
    empty.classList.toggle('d-none', invoices.length > 0);
    body.innerHTML = invoices.map((invoice) => `<tr><td class="fw-bold">INV-${String(invoice.invoice_number || 0).padStart(6, '0')}</td><td>${LIW.formatMoney(invoice.total_cents)}</td><td>${LIW.statusBadge(invoice.status)}</td><td>${LIW.formatDate(invoice.due_date)}</td><td>${LIW.formatDate(invoice.created_at)}</td><td><button class="btn btn-sm btn-outline-liw" data-invoice-view="${invoice.id}">View</button></td></tr>`).join('');
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
      const [servicesResult, profileResult, requestsResult, appointmentsResult, invoicesResult, documentsResult, messagesResult] = await Promise.all([
        LIW.db.from('service_catalog').select('id,name').eq('is_active', true).order('sort_order'),
        LIW.db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        LIW.db.from('service_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('appointments').select('*').eq('user_id', user.id).order('starts_at', { ascending: false }),
        LIW.db.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('portal_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      ]);
      const firstError = [servicesResult, profileResult, requestsResult, appointmentsResult, invoicesResult, documentsResult, messagesResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;
      services = servicesResult.data || [];
      requests = requestsResult.data || [];
      appointments = appointmentsResult.data || [];
      invoices = invoicesResult.data || [];
      documents = documentsResult.data || [];
      messages = messagesResult.data || [];
      renderProfile(profileResult.data);
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
    if (!form.request_id.value) return LIW.notify('warning', 'Choose a request', 'Select the LIW request connected to your message.');
    LIW.setLoading(true, 'Sending secure message…');
    const { error } = await LIW.db.from('portal_messages').insert({ request_id: form.request_id.value, user_id: user.id, sender_id: user.id, direction: 'customer_to_staff', subject: form.subject.value.trim(), body: form.body.value.trim() });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to send message', error.message);
    form.subject.value = ''; form.body.value = '';
    LIW.toast('success', 'Message sent to LIW');
    await loadDashboard();
    const trigger = document.querySelector('[data-bs-target="#messagesPane"]');
    if (trigger) window.bootstrap.Tab.getOrCreateInstance(trigger).show();
  }

  async function markMessagesRead() {
    const ids = messages.filter((message) => message.direction === 'staff_to_customer' && !message.read_at).map((message) => message.id);
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    const { error } = await LIW.db.from('portal_messages').update({ read_at: readAt }).in('id', ids);
    if (!error) { messages.forEach((message) => { if (ids.includes(message.id)) message.read_at = readAt; }); renderMessages(); }
  }

  async function openInvoice(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    LIW.setLoading(true, 'Loading invoice…');
    const { data: items, error } = await LIW.db.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order');
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to load invoice', error.message);
    const rows = (items || []).map((item) => `<tr><td>${LIW.escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${LIW.formatMoney(item.unit_price_cents)}</td><td class="text-end">${LIW.formatMoney(item.line_total_cents)}</td></tr>`).join('');
    window.Swal.fire({ title: `INV-${String(invoice.invoice_number || 0).padStart(6,'0')}`, html: `<div class="text-start"><div class="d-flex justify-content-between mb-3"><span>${LIW.statusBadge(invoice.status)}</span><strong class="fs-4">${LIW.formatMoney(invoice.total_cents)}</strong></div><div class="table-responsive"><table class="table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th class="text-end">Total</th></tr></thead><tbody>${rows}</tbody></table></div><dl class="detail-list"><dt>Subtotal</dt><dd>${LIW.formatMoney(invoice.subtotal_cents)}</dd><dt>Discount</dt><dd>${LIW.formatMoney(invoice.discount_cents)}</dd><dt>Tax / fees</dt><dd>${LIW.formatMoney(invoice.tax_cents)}</dd><dt>Due date</dt><dd>${LIW.formatDate(invoice.due_date)}</dd></dl>${invoice.notes ? `<hr><p>${LIW.escapeHtml(invoice.notes)}</p>` : ''}</div>`, width: 760, confirmButtonColor: '#263fa4' });
  }

  async function handleTableClick(event) {
    const requestButton = event.target.closest('[data-request-view]');
    if (requestButton) {
      const request = requestFor(requestButton.dataset.requestView);
      if (!request) return;
      const { data: notes } = await LIW.db.from('request_notes').select('note,created_at').eq('request_id', request.id).eq('visible_to_customer', true).order('created_at', { ascending: false });
      const notesHtml = notes?.length ? notes.map((note) => `<div class="border rounded-3 p-2 mb-2"><small class="text-secondary">${LIW.formatDate(note.created_at, true)}</small><div>${LIW.escapeHtml(note.note)}</div></div>`).join('') : '<p class="text-muted mb-0">No customer updates yet.</p>';
      window.Swal.fire({ title: LIW.requestNumber(request.request_number), html: `<div class="text-start"><p><strong>Service:</strong> ${LIW.escapeHtml(serviceName(request.service_id))}</p><p><strong>Subject:</strong> ${LIW.escapeHtml(request.subject)}</p><p><strong>Status:</strong> ${LIW.statusBadge(request.status)}</p><hr>${LIW.detailRows(request.details)}<hr><h6>Updates from LIW</h6>${notesHtml}</div>`, width: 680, confirmButtonColor: '#263fa4' });
      return;
    }
    const documentButton = event.target.closest('[data-document-open]');
    if (documentButton) {
      const documentItem = documents.find((item) => item.id === documentButton.dataset.documentOpen);
      if (!documentItem) return;
      LIW.setLoading(true, 'Opening document…');
      const { data, error } = await LIW.db.storage.from('liw-documents').createSignedUrl(documentItem.storage_path, 120);
      LIW.setLoading(false);
      if (error) return LIW.notify('error', 'Unable to open document', error.message);
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const invoiceButton = event.target.closest('[data-invoice-view]');
    if (invoiceButton) return openInvoice(invoiceButton.dataset.invoiceView);
  }

  async function init() {
    const auth = await LIW.requireAuth();
    if (!auth) return;
    user = auth.user; role = auth.role;
    document.querySelectorAll('[data-staff-link]').forEach((node) => node.classList.toggle('d-none', !['staff', 'admin', 'owner'].includes(role)));
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('documentForm').addEventListener('submit', uploadDocument);
    document.getElementById('clientMessageForm').addEventListener('submit', sendClientMessage);
    document.addEventListener('click', handleTableClick);
    document.querySelector('[data-bs-target="#messagesPane"]').addEventListener('shown.bs.tab', markMessagesRead);
    document.querySelectorAll('[data-open-tab]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); const target = link.dataset.openTab; const trigger = document.querySelector(`[data-bs-target="${target}"]`); if (trigger && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(trigger).show(); document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    await loadDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
