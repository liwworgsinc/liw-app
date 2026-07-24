(function adminPage() {
  'use strict';

  const LIW = window.LIW;
  let user = null;
  let services = [];
  let requests = [];
  let profiles = [];
  let invoices = [];
  let documents = [];
  let appointments = [];
  let messages = [];
  let statusChart = null;
  let selectedRequest = null;
  let workspaceModal = null;

  const serviceName = (id) => services.find((service) => service.id === id)?.name || 'LIW Service';
  const profileFor = (id) => profiles.find((profile) => profile.id === id) || {};
  const requestFor = (id) => requests.find((request) => request.id === id) || null;
  const moneyToCents = (value) => Math.max(0, Math.round((Number(value) || 0) * 100));

  function filteredRequests() {
    const search = document.getElementById('adminSearch').value.trim().toLowerCase();
    const status = document.getElementById('adminStatusFilter').value;
    const service = document.getElementById('adminServiceFilter').value;
    return requests.filter((request) => {
      const profile = profileFor(request.user_id);
      const haystack = [request.subject, request.request_number, profile.full_name, profile.email, profile.phone, serviceName(request.service_id)].join(' ').toLowerCase();
      return (!search || haystack.includes(search)) && (!status || request.status === status) && (!service || request.service_id === service);
    });
  }

  function renderStats() {
    const now = Date.now();
    document.getElementById('adminStatLeads').textContent = requests.length;
    document.getElementById('adminStatNew').textContent = requests.filter((request) => request.status === 'submitted').length;
    document.getElementById('adminStatDocs').textContent = documents.length;
    document.getElementById('adminStatAppointments').textContent = appointments.filter((item) => new Date(item.starts_at).getTime() >= now && !['cancelled', 'completed', 'no_show'].includes(item.status)).length;
    document.getElementById('adminStatMessages').textContent = messages.filter((item) => item.direction === 'customer_to_staff' && !item.read_at).length;
    document.getElementById('adminStatRevenue').textContent = LIW.formatMoney(invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0));
  }

  function renderChart() {
    const canvas = document.getElementById('statusChart');
    if (!canvas || !window.Chart) return;
    const labels = ['Submitted', 'Contacted', 'Documents Needed', 'Appointment', 'Payment Due', 'In Progress', 'Completed'];
    const keys = ['submitted', 'contacted', 'documents_needed', 'appointment_scheduled', 'payment_due', 'in_progress', 'completed'];
    const values = keys.map((key) => requests.filter((request) => request.status === key).length);
    statusChart?.destroy();
    statusChart = new window.Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Requests', data: values, borderWidth: 1, borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  function statusOptions(selected) {
    const options = ['submitted','contacted','documents_needed','appointment_scheduled','payment_due','in_progress','completed','closed'];
    return options.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${LIW.escapeHtml(LIW.statusLabels[status])}</option>`).join('');
  }

  function priorityOptions(selected) {
    return ['low','normal','high','urgent'].map((priority) => `<option value="${priority}" ${priority === selected ? 'selected' : ''}>${priority[0].toUpperCase() + priority.slice(1)}</option>`).join('');
  }

  function renderRequests() {
    const list = filteredRequests();
    const body = document.getElementById('adminRequestsBody');
    const empty = document.getElementById('adminRequestsEmpty');
    empty.classList.toggle('d-none', list.length > 0);
    body.innerHTML = list.map((request) => {
      const profile = profileFor(request.user_id);
      const docCount = documents.filter((item) => item.user_id === request.user_id && (item.request_id === request.id || !item.request_id)).length;
      const unread = messages.filter((item) => item.request_id === request.id && item.direction === 'customer_to_staff' && !item.read_at).length;
      return `<tr>
        <td><div class="fw-bold">${LIW.requestNumber(request.request_number)}</div><small class="text-secondary">${LIW.escapeHtml(request.subject)}</small></td>
        <td><div class="fw-semibold">${LIW.escapeHtml(profile.full_name || 'Unnamed client')}</div><small class="text-secondary">${LIW.escapeHtml(profile.email || '')}</small></td>
        <td>${LIW.escapeHtml(serviceName(request.service_id))}</td>
        <td><select class="form-select form-select-sm" data-status-request="${request.id}">${statusOptions(request.status)}</select></td>
        <td><select class="form-select form-select-sm" data-priority-request="${request.id}">${priorityOptions(request.priority)}</select></td>
        <td>${LIW.formatDate(request.created_at)}</td>
        <td><button class="btn btn-sm btn-liw position-relative" data-open-workspace="${request.id}"><i class="bi bi-window-stack me-1"></i>Open <span class="workspace-mini-count">${docCount}</span>${unread ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">${unread}</span>` : ''}</button></td>
      </tr>`;
    }).join('');
  }

  function operationEmpty(icon, text) {
    return `<div class="operation-empty"><i class="bi ${icon}"></i><span>${LIW.escapeHtml(text)}</span></div>`;
  }

  function renderOperationQueues() {
    const now = Date.now();
    const upcoming = appointments.filter((item) => new Date(item.starts_at).getTime() >= now && !['cancelled','completed','no_show'].includes(item.status)).sort((a,b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 6);
    document.getElementById('upcomingCount').textContent = upcoming.length;
    document.getElementById('upcomingAppointments').innerHTML = upcoming.length ? upcoming.map((item) => {
      const request = requestFor(item.request_id);
      const profile = request ? profileFor(request.user_id) : {};
      return `<button class="operation-row" data-open-workspace="${request?.id || ''}"><span class="operation-icon"><i class="bi bi-calendar-event"></i></span><span><strong>${LIW.escapeHtml(profile.full_name || 'Client')}</strong><small>${LIW.formatDate(item.starts_at, true)} · ${LIW.escapeHtml(item.appointment_type.replaceAll('_',' '))}</small></span><i class="bi bi-chevron-right ms-auto"></i></button>`;
    }).join('') : operationEmpty('bi-calendar-x', 'No upcoming appointments.');

    const openInvoices = invoices.filter((item) => !['paid','void'].includes(item.status)).slice(0, 6);
    document.getElementById('openInvoiceCount').textContent = openInvoices.length;
    document.getElementById('openInvoices').innerHTML = openInvoices.length ? openInvoices.map((invoice) => {
      const request = requestFor(invoice.request_id);
      const profile = profileFor(invoice.user_id);
      return `<button class="operation-row" data-open-workspace="${request?.id || ''}"><span class="operation-icon"><i class="bi bi-receipt"></i></span><span><strong>INV-${String(invoice.invoice_number || 0).padStart(6,'0')} · ${LIW.formatMoney(invoice.total_cents)}</strong><small>${LIW.escapeHtml(profile.full_name || 'Client')} · Due ${LIW.formatDate(invoice.due_date)}</small></span>${LIW.statusBadge(invoice.status)}</button>`;
    }).join('') : operationEmpty('bi-check2-circle', 'No open invoices.');

    const recentDocs = documents.slice(0, 6);
    document.getElementById('documentCount').textContent = documents.length;
    document.getElementById('recentDocuments').innerHTML = recentDocs.length ? recentDocs.map((doc) => {
      const request = requestFor(doc.request_id);
      const profile = profileFor(doc.user_id);
      return `<button class="operation-row" data-open-workspace="${request?.id || requests.find((r) => r.user_id === doc.user_id)?.id || ''}"><span class="operation-icon"><i class="bi bi-file-earmark-text"></i></span><span><strong>${LIW.escapeHtml(doc.file_name)}</strong><small>${LIW.escapeHtml(profile.full_name || 'Client')} · ${LIW.escapeHtml(doc.category || 'General')}</small></span>${LIW.statusBadge(doc.status)}</button>`;
    }).join('') : operationEmpty('bi-folder2-open', 'No client documents yet.');

    const recentMessages = messages.filter((item) => item.direction === 'customer_to_staff').slice(0, 6);
    document.getElementById('messageCount').textContent = recentMessages.length;
    document.getElementById('recentMessages').innerHTML = recentMessages.length ? recentMessages.map((message) => {
      const request = requestFor(message.request_id);
      const profile = profileFor(message.user_id);
      return `<button class="operation-row ${message.read_at ? '' : 'unread'}" data-open-workspace="${request?.id || ''}" data-workspace-tab="messages"><span class="operation-icon"><i class="bi bi-chat-left-text"></i></span><span><strong>${LIW.escapeHtml(message.subject)}</strong><small>${LIW.escapeHtml(profile.full_name || 'Client')} · ${LIW.formatDate(message.created_at, true)}</small></span>${message.read_at ? '' : '<span class="unread-dot"></span>'}</button>`;
    }).join('') : operationEmpty('bi-chat-square', 'No client replies yet.');
  }

  async function loadAdmin(showLoader = true) {
    if (showLoader) LIW.setLoading(true, 'Loading LIW Command Center…');
    try {
      const [servicesResult, requestsResult, profilesResult, invoicesResult, documentsResult, appointmentsResult, messagesResult] = await Promise.all([
        LIW.db.from('service_catalog').select('id,name').order('sort_order'),
        LIW.db.from('service_requests').select('*').order('created_at', { ascending: false }),
        LIW.db.from('profiles').select('id,email,full_name,phone,company_name,preferred_contact'),
        LIW.db.from('invoices').select('*').order('created_at', { ascending: false }),
        LIW.db.from('documents').select('*').order('created_at', { ascending: false }),
        LIW.db.from('appointments').select('*').order('starts_at', { ascending: false }),
        LIW.db.from('portal_messages').select('*').order('created_at', { ascending: false })
      ]);
      const firstError = [servicesResult, requestsResult, profilesResult, invoicesResult, documentsResult, appointmentsResult, messagesResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;
      services = servicesResult.data || [];
      requests = requestsResult.data || [];
      profiles = profilesResult.data || [];
      invoices = invoicesResult.data || [];
      documents = documentsResult.data || [];
      appointments = appointmentsResult.data || [];
      messages = messagesResult.data || [];

      const serviceFilter = document.getElementById('adminServiceFilter');
      const selectedService = serviceFilter.value;
      serviceFilter.innerHTML = '<option value="">All services</option>' + services.map((service) => `<option value="${service.id}">${LIW.escapeHtml(service.name)}</option>`).join('');
      serviceFilter.value = selectedService;
      renderStats();
      renderRequests();
      renderChart();
      renderOperationQueues();
      document.querySelector('[data-admin-name]').textContent = user.email || 'LIW Staff';
      if (selectedRequest) {
        selectedRequest = requestFor(selectedRequest.id);
        if (selectedRequest) await renderWorkspace();
      }
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Unable to load dashboard', error.message || 'Please refresh the page.');
    } finally {
      if (showLoader) LIW.setLoading(false);
    }
  }

  async function updateRequest(id, changes) {
    const original = requestFor(id);
    if (!original) return;
    const previous = { ...original };
    Object.assign(original, changes);
    renderRequests();
    renderStats();
    renderChart();
    const { error } = await LIW.db.from('service_requests').update(changes).eq('id', id);
    if (error) {
      Object.assign(original, previous);
      renderRequests();
      await LIW.notify('error', 'Update failed', error.message);
      return;
    }
    LIW.toast('success', 'Request updated');
    if (selectedRequest?.id === id) await renderWorkspace();
  }

  function workspaceClientDocuments() {
    if (!selectedRequest) return [];
    return documents.filter((item) => item.user_id === selectedRequest.user_id && (item.request_id === selectedRequest.id || !item.request_id));
  }

  function renderWorkspaceHeader() {
    const request = selectedRequest;
    const profile = profileFor(request.user_id);
    document.getElementById('workspaceTitle').textContent = `${LIW.requestNumber(request.request_number)} — ${profile.full_name || 'Client'}`;
    document.getElementById('workspaceSubtitle').textContent = `${serviceName(request.service_id)} · ${request.subject}`;
    document.getElementById('workspaceClientBar').innerHTML = `<div><span class="workspace-avatar">${LIW.escapeHtml((profile.full_name || profile.email || 'C').charAt(0).toUpperCase())}</span></div><div class="flex-grow-1"><strong>${LIW.escapeHtml(profile.full_name || 'Unnamed client')}</strong><div class="text-secondary small">${LIW.escapeHtml(profile.email || '')} · ${LIW.escapeHtml(profile.phone || 'No phone')} ${profile.company_name ? `· ${LIW.escapeHtml(profile.company_name)}` : ''}</div></div><div class="d-flex flex-wrap gap-2">${LIW.statusBadge(request.status)}<span class="priority-chip priority-${LIW.escapeHtml(request.priority)}">${LIW.escapeHtml(request.priority)}</span></div>`;
  }

  async function loadWorkspaceNotes() {
    const { data, error } = await LIW.db.from('request_notes').select('*').eq('request_id', selectedRequest.id).order('created_at', { ascending: false });
    const container = document.getElementById('workspaceNotes');
    if (error || !data?.length) {
      container.innerHTML = '<div class="operation-empty"><i class="bi bi-journal-text"></i><span>No case notes yet.</span></div>';
      return;
    }
    container.innerHTML = data.map((note) => `<article class="timeline-note"><div class="timeline-dot"></div><div><div class="d-flex flex-wrap gap-2 align-items-center"><strong>${note.visible_to_customer ? 'Client update' : 'Internal note'}</strong><small class="text-secondary">${LIW.formatDate(note.created_at, true)}</small></div><p class="mb-0 mt-1">${LIW.escapeHtml(note.note)}</p></div></article>`).join('');
  }

  function renderWorkspaceOverview() {
    document.getElementById('workspaceRequestDetails').innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3">${LIW.statusBadge(selectedRequest.status)}<span class="priority-chip priority-${LIW.escapeHtml(selectedRequest.priority)}">${LIW.escapeHtml(selectedRequest.priority)} priority</span></div><dl class="detail-list"><dt>Service</dt><dd>${LIW.escapeHtml(serviceName(selectedRequest.service_id))}</dd><dt>Subject</dt><dd>${LIW.escapeHtml(selectedRequest.subject)}</dd><dt>Submitted</dt><dd>${LIW.formatDate(selectedRequest.created_at, true)}</dd><dt>Preferred contact</dt><dd>${LIW.escapeHtml(selectedRequest.details?.preferred_contact || profileFor(selectedRequest.user_id).preferred_contact || 'Not provided')}</dd></dl><hr>${LIW.detailRows(selectedRequest.details)}`;
  }

  function renderWorkspaceDocuments() {
    const list = workspaceClientDocuments();
    document.getElementById('workspaceDocCount').textContent = list.length;
    document.getElementById('workspaceDocumentsEmpty').classList.toggle('d-none', list.length > 0);
    document.getElementById('workspaceDocumentsBody').innerHTML = list.map((doc) => {
      const linkedRequest = requestFor(doc.request_id);
      return `<tr><td><div class="fw-semibold">${LIW.escapeHtml(doc.file_name)}</div><small class="text-secondary">${doc.size_bytes ? `${(doc.size_bytes / 1024 / 1024).toFixed(2)} MB` : ''}</small></td><td>${LIW.escapeHtml(doc.category || 'General')}</td><td>${linkedRequest ? LIW.requestNumber(linkedRequest.request_number) : 'General'}</td><td><select class="form-select form-select-sm" data-document-status="${doc.id}"><option value="uploaded" ${doc.status === 'uploaded' ? 'selected' : ''}>Uploaded</option><option value="reviewed" ${doc.status === 'reviewed' ? 'selected' : ''}>Reviewed</option><option value="accepted" ${doc.status === 'accepted' ? 'selected' : ''}>Accepted</option><option value="rejected" ${doc.status === 'rejected' ? 'selected' : ''}>Rejected</option></select></td><td>${LIW.formatDate(doc.created_at)}</td><td><button class="btn btn-sm btn-liw" data-document-open="${doc.id}"><i class="bi bi-box-arrow-up-right me-1"></i>Open</button></td></tr>`;
    }).join('');
  }

  function renderWorkspaceAppointments() {
    const list = appointments.filter((item) => item.request_id === selectedRequest.id).sort((a,b) => new Date(b.starts_at) - new Date(a.starts_at));
    document.getElementById('workspaceAppointmentList').innerHTML = list.length ? list.map((item) => `<article class="operation-card"><div class="operation-card-icon"><i class="bi bi-calendar-event"></i></div><div class="flex-grow-1"><strong>${LIW.formatDate(item.starts_at, true)}</strong><div class="small text-secondary">${LIW.escapeHtml(item.appointment_type.replaceAll('_',' '))} · ${LIW.escapeHtml(item.location || 'Location to be confirmed')}</div>${item.notes ? `<p class="small mb-0 mt-2">${LIW.escapeHtml(item.notes)}</p>` : ''}</div><select class="form-select form-select-sm appointment-status-select" data-appointment-status="${item.id}"><option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>Scheduled</option><option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option><option value="no_show" ${item.status === 'no_show' ? 'selected' : ''}>No Show</option></select></article>`).join('') : operationEmpty('bi-calendar-plus', 'No appointments have been scheduled for this request.');
  }

  function renderWorkspaceInvoices() {
    const list = invoices.filter((item) => item.request_id === selectedRequest.id);
    document.getElementById('workspaceInvoiceList').innerHTML = list.length ? list.map((invoice) => `<article class="operation-card"><div class="operation-card-icon"><i class="bi bi-receipt"></i></div><div class="flex-grow-1"><strong>INV-${String(invoice.invoice_number || 0).padStart(6,'0')} · ${LIW.formatMoney(invoice.total_cents)}</strong><div class="small text-secondary">Due ${LIW.formatDate(invoice.due_date)} · Created ${LIW.formatDate(invoice.created_at)}</div></div><div class="d-flex flex-column gap-2"><select class="form-select form-select-sm" data-invoice-status="${invoice.id}"><option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Draft</option><option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Sent</option><option value="partial" ${invoice.status === 'partial' ? 'selected' : ''}>Partial</option><option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Paid</option><option value="overdue" ${invoice.status === 'overdue' ? 'selected' : ''}>Overdue</option><option value="void" ${invoice.status === 'void' ? 'selected' : ''}>Void</option></select><button class="btn btn-sm btn-outline-liw" data-invoice-view="${invoice.id}">View</button></div></article>`).join('') : operationEmpty('bi-receipt-cutoff', 'No invoices have been created for this request.');
  }

  async function markClientRepliesRead() {
    const unreadIds = messages.filter((item) => item.request_id === selectedRequest.id && item.direction === 'customer_to_staff' && !item.read_at).map((item) => item.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    const { error } = await LIW.db.from('portal_messages').update({ read_at: readAt }).in('id', unreadIds);
    if (!error) messages.forEach((item) => { if (unreadIds.includes(item.id)) item.read_at = readAt; });
  }

  function renderWorkspaceMessages() {
    const list = messages.filter((item) => item.request_id === selectedRequest.id).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    document.getElementById('workspaceMessageThread').innerHTML = list.length ? list.map((message) => `<article class="portal-message ${message.direction === 'staff_to_customer' ? 'outgoing' : 'incoming'}"><div class="portal-message-meta"><strong>${message.direction === 'staff_to_customer' ? 'LIW Worgs Inc.' : LIW.escapeHtml(profileFor(message.user_id).full_name || 'Client')}</strong><span>${LIW.formatDate(message.created_at, true)}</span></div><h4>${LIW.escapeHtml(message.subject)}</h4><p>${LIW.escapeHtml(message.body)}</p></article>`).join('') : '<div class="operation-empty"><i class="bi bi-chat-square-text"></i><span>No portal messages yet. Send the first update.</span></div>';
    const thread = document.getElementById('workspaceMessageThread');
    thread.scrollTop = thread.scrollHeight;
  }

  async function renderWorkspace() {
    if (!selectedRequest) return;
    renderWorkspaceHeader();
    renderWorkspaceOverview();
    renderWorkspaceDocuments();
    renderWorkspaceAppointments();
    renderWorkspaceInvoices();
    renderWorkspaceMessages();
    await loadWorkspaceNotes();
  }

  async function openWorkspace(requestId, tab = 'overview') {
    selectedRequest = requestFor(requestId);
    if (!selectedRequest) return;
    await markClientRepliesRead();
    await renderWorkspace();
    renderStats();
    renderRequests();
    renderOperationQueues();
    workspaceModal.show();
    const targetMap = { overview: '#workspaceOverview', documents: '#workspaceDocuments', appointments: '#workspaceAppointments', invoices: '#workspaceInvoices', messages: '#workspaceMessages' };
    const trigger = document.querySelector(`[data-bs-target="${targetMap[tab] || '#workspaceOverview'}"]`);
    if (trigger) window.bootstrap.Tab.getOrCreateInstance(trigger).show();
  }

  async function saveWorkspaceNote(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    const form = event.currentTarget;
    LIW.setLoading(true, 'Saving case note…');
    const { error } = await LIW.db.from('request_notes').insert({ request_id: selectedRequest.id, author_id: user.id, note: form.note.value.trim(), visible_to_customer: form.visible_to_customer.checked });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to save note', error.message);
    form.reset();
    LIW.toast('success', 'Case note saved');
    await loadWorkspaceNotes();
  }

  async function openDocument(documentId) {
    const documentItem = documents.find((item) => item.id === documentId);
    if (!documentItem) return;
    LIW.setLoading(true, 'Opening private document…');
    const { data, error } = await LIW.db.storage.from('liw-documents').createSignedUrl(documentItem.storage_path, 300);
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to open document', error.message);
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function updateDocumentStatus(documentId, status) {
    const { error } = await LIW.db.from('documents').update({ status }).eq('id', documentId);
    if (error) return LIW.notify('error', 'Unable to update document', error.message);
    const item = documents.find((doc) => doc.id === documentId);
    if (item) item.status = status;
    LIW.toast('success', 'Document status updated');
    renderWorkspaceDocuments();
    renderOperationQueues();
  }

  async function scheduleAppointment(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    const form = event.currentTarget;
    const starts = new Date(form.starts_at.value);
    const ends = new Date(form.ends_at.value);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) return LIW.notify('warning', 'Check appointment times', 'The end time must be after the start time.');
    LIW.setLoading(true, 'Scheduling appointment…');
    const { error } = await LIW.db.rpc('schedule_request_appointment', { p_request_id: selectedRequest.id, p_starts_at: starts.toISOString(), p_ends_at: ends.toISOString(), p_appointment_type: form.appointment_type.value, p_location: form.location.value.trim(), p_notes: form.notes.value.trim() });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to schedule appointment', error.message);
    form.reset();
    setAppointmentDefaults();
    LIW.toast('success', 'Appointment added to the client portal');
    await loadAdmin(false);
  }

  function setAppointmentDefaults() {
    const form = document.getElementById('appointmentForm');
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const localValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    form.starts_at.value = localValue(start);
    form.ends_at.value = localValue(end);
  }

  function invoiceItemTemplate(description = '', quantity = '1', price = '') {
    return `<div class="invoice-item-row"><div class="flex-grow-1"><label class="form-label">Description</label><input class="form-control" data-item-description value="${LIW.escapeHtml(description)}" placeholder="Service or product" required></div><div class="invoice-item-qty"><label class="form-label">Qty</label><input class="form-control" data-item-quantity type="number" min="0.01" step="0.01" value="${LIW.escapeHtml(quantity)}" required></div><div class="invoice-item-price"><label class="form-label">Unit price</label><div class="input-group"><span class="input-group-text">$</span><input class="form-control" data-item-price type="number" min="0" step="0.01" value="${LIW.escapeHtml(price)}" required></div></div><button class="btn btn-outline-danger invoice-remove-item" type="button" title="Remove item"><i class="bi bi-trash"></i></button></div>`;
  }

  function addInvoiceItem(description = '', quantity = '1', price = '') {
    document.getElementById('invoiceItems').insertAdjacentHTML('beforeend', invoiceItemTemplate(description, quantity, price));
    updateInvoicePreview();
  }

  function updateInvoicePreview() {
    const rows = [...document.querySelectorAll('.invoice-item-row')];
    const subtotal = rows.reduce((sum, row) => sum + (Number(row.querySelector('[data-item-quantity]').value) || 0) * moneyToCents(row.querySelector('[data-item-price]').value), 0);
    const form = document.getElementById('invoiceForm');
    const total = Math.max(0, subtotal - moneyToCents(form.discount.value) + moneyToCents(form.tax.value));
    document.getElementById('invoicePreviewTotal').textContent = LIW.formatMoney(total);
  }

  function resetInvoiceForm() {
    const form = document.getElementById('invoiceForm');
    form.reset();
    document.getElementById('invoiceItems').innerHTML = '';
    addInvoiceItem(serviceName(selectedRequest?.service_id), '1', '');
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    form.due_date.value = due.toISOString().slice(0,10);
    updateInvoicePreview();
  }

  async function createInvoice(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    const form = event.currentTarget;
    const items = [...document.querySelectorAll('.invoice-item-row')].map((row) => ({ description: row.querySelector('[data-item-description]').value.trim(), quantity: Number(row.querySelector('[data-item-quantity]').value) || 1, unit_price_cents: moneyToCents(row.querySelector('[data-item-price]').value) }));
    if (!items.length || items.some((item) => !item.description || item.quantity <= 0)) return LIW.notify('warning', 'Check invoice items', 'Every invoice item needs a description and valid quantity.');
    LIW.setLoading(true, 'Creating invoice…');
    const { data, error } = await LIW.db.rpc('create_invoice_for_request', { p_request_id: selectedRequest.id, p_due_date: form.due_date.value || null, p_notes: form.notes.value.trim(), p_items: items, p_discount_cents: moneyToCents(form.discount.value), p_tax_cents: moneyToCents(form.tax.value) });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to create invoice', error.message);
    resetInvoiceForm();
    const invoiceNumber = data?.[0]?.invoice_number;
    await LIW.notify('success', 'Invoice sent to client portal', invoiceNumber ? `Invoice INV-${String(invoiceNumber).padStart(6,'0')} is now available to the client.` : 'The invoice is now available to the client.');
    await loadAdmin(false);
  }

  async function viewInvoice(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    LIW.setLoading(true, 'Loading invoice…');
    const { data: items, error } = await LIW.db.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order');
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to load invoice', error.message);
    const rows = (items || []).map((item) => `<tr><td>${LIW.escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${LIW.formatMoney(item.unit_price_cents)}</td><td class="text-end">${LIW.formatMoney(item.line_total_cents)}</td></tr>`).join('');
    window.Swal.fire({ title: `INV-${String(invoice.invoice_number || 0).padStart(6,'0')}`, html: `<div class="text-start"><div class="d-flex justify-content-between mb-3"><span>${LIW.statusBadge(invoice.status)}</span><strong class="fs-4">${LIW.formatMoney(invoice.total_cents)}</strong></div><div class="table-responsive"><table class="table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th class="text-end">Total</th></tr></thead><tbody>${rows}</tbody></table></div><dl class="detail-list"><dt>Subtotal</dt><dd>${LIW.formatMoney(invoice.subtotal_cents)}</dd><dt>Discount</dt><dd>${LIW.formatMoney(invoice.discount_cents)}</dd><dt>Tax / fees</dt><dd>${LIW.formatMoney(invoice.tax_cents)}</dd><dt>Due date</dt><dd>${LIW.formatDate(invoice.due_date)}</dd></dl>${invoice.notes ? `<hr><p>${LIW.escapeHtml(invoice.notes)}</p>` : ''}</div>`, width: 760, confirmButtonColor: '#263fa4' });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    const form = event.currentTarget;
    LIW.setLoading(true, 'Sending portal message…');
    const { error } = await LIW.db.from('portal_messages').insert({ request_id: selectedRequest.id, user_id: selectedRequest.user_id, sender_id: user.id, direction: 'staff_to_customer', subject: form.subject.value.trim(), body: form.body.value.trim() });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to send message', error.message);
    form.body.value = '';
    LIW.toast('success', 'Message delivered to client portal');
    await loadAdmin(false);
  }

  async function handleChange(event) {
    const statusSelect = event.target.closest('[data-status-request]');
    if (statusSelect) return updateRequest(statusSelect.dataset.statusRequest, { status: statusSelect.value });
    const prioritySelect = event.target.closest('[data-priority-request]');
    if (prioritySelect) return updateRequest(prioritySelect.dataset.priorityRequest, { priority: prioritySelect.value });
    const docStatus = event.target.closest('[data-document-status]');
    if (docStatus) return updateDocumentStatus(docStatus.dataset.documentStatus, docStatus.value);
    const appointmentStatus = event.target.closest('[data-appointment-status]');
    if (appointmentStatus) {
      const { error } = await LIW.db.from('appointments').update({ status: appointmentStatus.value }).eq('id', appointmentStatus.dataset.appointmentStatus);
      if (error) return LIW.notify('error', 'Unable to update appointment', error.message);
      const item = appointments.find((appointment) => appointment.id === appointmentStatus.dataset.appointmentStatus);
      if (item) item.status = appointmentStatus.value;
      LIW.toast('success', 'Appointment updated');
      renderWorkspaceAppointments(); renderStats(); renderOperationQueues();
      return;
    }
    const invoiceStatus = event.target.closest('[data-invoice-status]');
    if (invoiceStatus) {
      const { error } = await LIW.db.from('invoices').update({ status: invoiceStatus.value }).eq('id', invoiceStatus.dataset.invoiceStatus);
      if (error) return LIW.notify('error', 'Unable to update invoice', error.message);
      const item = invoices.find((invoice) => invoice.id === invoiceStatus.dataset.invoiceStatus);
      if (item) item.status = invoiceStatus.value;
      LIW.toast('success', 'Invoice updated');
      renderWorkspaceInvoices(); renderStats(); renderOperationQueues();
    }
  }

  async function handleClick(event) {
    const workspaceButton = event.target.closest('[data-open-workspace]');
    if (workspaceButton?.dataset.openWorkspace) return openWorkspace(workspaceButton.dataset.openWorkspace, workspaceButton.dataset.workspaceTab || 'overview');
    const documentButton = event.target.closest('[data-document-open]');
    if (documentButton) return openDocument(documentButton.dataset.documentOpen);
    const invoiceButton = event.target.closest('[data-invoice-view]');
    if (invoiceButton) return viewInvoice(invoiceButton.dataset.invoiceView);
    const removeItem = event.target.closest('.invoice-remove-item');
    if (removeItem) {
      const rows = document.querySelectorAll('.invoice-item-row');
      if (rows.length > 1) removeItem.closest('.invoice-item-row').remove();
      updateInvoicePreview();
    }
  }

  async function init() {
    const auth = await LIW.requireAuth({ staffOnly: true });
    if (!auth) return;
    user = auth.user;
    workspaceModal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('clientWorkspaceModal'));
    document.getElementById('adminSearch').addEventListener('input', renderRequests);
    document.getElementById('adminStatusFilter').addEventListener('change', renderRequests);
    document.getElementById('adminServiceFilter').addEventListener('change', renderRequests);
    document.getElementById('workspaceNoteForm').addEventListener('submit', saveWorkspaceNote);
    document.getElementById('appointmentForm').addEventListener('submit', scheduleAppointment);
    document.getElementById('invoiceForm').addEventListener('submit', createInvoice);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('addInvoiceItem').addEventListener('click', () => addInvoiceItem());
    document.getElementById('invoiceForm').addEventListener('input', updateInvoicePreview);
    document.getElementById('appointmentForm').elements.starts_at.addEventListener('change', (event) => {
      const start = new Date(event.target.value);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        document.getElementById('appointmentForm').elements.ends_at.value = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      }
    });
    document.addEventListener('change', handleChange);
    document.addEventListener('click', handleClick);
    document.getElementById('clientWorkspaceModal').addEventListener('shown.bs.modal', () => { setAppointmentDefaults(); resetInvoiceForm(); });
    await loadAdmin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
