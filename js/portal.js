(function portalPage() {
  'use strict';

  const LIW = window.LIW;
  let user = null;
  let role = 'customer';
  let services = [];
  let requests = [];
  let documents = [];

  const serviceName = (id) => services.find((service) => service.id === id)?.name || 'LIW Service';

  function renderStats(appointments, invoices) {
    document.getElementById('statRequests').textContent = requests.length;
    document.getElementById('statActive').textContent = requests.filter((item) => !['completed', 'closed'].includes(item.status)).length;
    document.getElementById('statAppointments').textContent = appointments.filter((item) => !['cancelled', 'completed', 'no_show'].includes(item.status)).length;
    document.getElementById('statBalance').textContent = LIW.formatMoney(
      invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0)
    );
  }

  function renderRequests() {
    const body = document.getElementById('requestsTableBody');
    const empty = document.getElementById('requestsEmpty');
    body.innerHTML = '';
    empty.classList.toggle('d-none', requests.length > 0);
    if (!requests.length) return;

    body.innerHTML = requests.map((request) => `
      <tr>
        <td class="fw-bold">${LIW.requestNumber(request.request_number)}</td>
        <td>${LIW.escapeHtml(serviceName(request.service_id))}</td>
        <td>${LIW.escapeHtml(request.subject)}</td>
        <td>${LIW.statusBadge(request.status)}</td>
        <td>${LIW.formatDate(request.created_at)}</td>
        <td><button class="btn btn-sm btn-outline-liw" data-request-view="${request.id}">View</button></td>
      </tr>
    `).join('');
  }

  function renderDocuments() {
    const body = document.getElementById('documentsTableBody');
    const empty = document.getElementById('documentsEmpty');
    empty.classList.toggle('d-none', documents.length > 0);
    body.innerHTML = documents.map((documentItem) => `
      <tr>
        <td class="fw-semibold">${LIW.escapeHtml(documentItem.file_name)}</td>
        <td>${LIW.escapeHtml(documentItem.category)}</td>
        <td>${LIW.statusBadge(documentItem.status)}</td>
        <td>${LIW.formatDate(documentItem.created_at)}</td>
        <td><button class="btn btn-sm btn-outline-secondary" data-document-open="${documentItem.id}"><i class="bi bi-box-arrow-up-right"></i> Open</button></td>
      </tr>
    `).join('');
  }

  function renderAppointments(appointments) {
    const body = document.getElementById('appointmentsTableBody');
    const empty = document.getElementById('appointmentsEmpty');
    empty.classList.toggle('d-none', appointments.length > 0);
    body.innerHTML = appointments.map((appointment) => `
      <tr>
        <td>${LIW.formatDate(appointment.starts_at, true)}</td>
        <td>${LIW.escapeHtml(appointment.appointment_type.replaceAll('_', ' '))}</td>
        <td>${LIW.escapeHtml(appointment.location || 'To be confirmed')}</td>
        <td>${LIW.statusBadge(appointment.status)}</td>
      </tr>
    `).join('');
  }

  function renderInvoices(invoices) {
    const body = document.getElementById('invoicesTableBody');
    const empty = document.getElementById('invoicesEmpty');
    empty.classList.toggle('d-none', invoices.length > 0);
    body.innerHTML = invoices.map((invoice) => `
      <tr>
        <td class="fw-bold">INV-${String(invoice.invoice_number || 0).padStart(6, '0')}</td>
        <td>${LIW.formatMoney(invoice.total_cents)}</td>
        <td>${LIW.statusBadge(invoice.status)}</td>
        <td>${LIW.formatDate(invoice.due_date)}</td>
        <td>${LIW.formatDate(invoice.created_at)}</td>
      </tr>
    `).join('');
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

  async function loadDashboard() {
    LIW.setLoading(true, 'Loading your LIW portal…');
    try {
      const [servicesResult, profileResult, requestsResult, appointmentsResult, invoicesResult, documentsResult] = await Promise.all([
        LIW.db.from('service_catalog').select('id,name').eq('is_active', true).order('sort_order'),
        LIW.db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        LIW.db.from('service_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('appointments').select('*').eq('user_id', user.id).order('starts_at', { ascending: false }),
        LIW.db.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        LIW.db.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      const firstError = [servicesResult, profileResult, requestsResult, appointmentsResult, invoicesResult, documentsResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      services = servicesResult.data || [];
      requests = requestsResult.data || [];
      documents = documentsResult.data || [];
      const appointments = appointmentsResult.data || [];
      const invoices = invoicesResult.data || [];

      renderProfile(profileResult.data);
      renderStats(appointments, invoices);
      renderRequests();
      renderDocuments();
      renderAppointments(appointments);
      renderInvoices(invoices);

      const requestSelect = document.getElementById('documentRequest');
      requestSelect.innerHTML = '<option value="">General document</option>' + requests.map((request) =>
        `<option value="${request.id}">${LIW.requestNumber(request.request_number)} — ${LIW.escapeHtml(serviceName(request.service_id))}</option>`
      ).join('');
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
    const { error } = await LIW.db.from('profiles').update({
      full_name: form.full_name.value.trim(),
      phone: form.phone.value.trim(),
      company_name: form.company_name.value.trim(),
      preferred_contact: form.preferred_contact.value
    }).eq('id', user.id);
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
      const { error: rowError } = await LIW.db.from('documents').insert({
        request_id: requestId,
        user_id: user.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category: form.category.value.trim() || 'general'
      });
      if (rowError) {
        await LIW.db.storage.from('liw-documents').remove([path]);
        throw rowError;
      }
      form.reset();
      LIW.toast('success', 'Document uploaded');
      await loadDashboard();
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Upload failed', error.message || 'Please try again.');
    } finally {
      LIW.setLoading(false);
    }
  }

  async function handleTableClick(event) {
    const requestButton = event.target.closest('[data-request-view]');
    if (requestButton) {
      const request = requests.find((item) => item.id === requestButton.dataset.requestView);
      if (!request) return;
      const { data: notes } = await LIW.db
        .from('request_notes')
        .select('note,created_at')
        .eq('request_id', request.id)
        .eq('visible_to_customer', true)
        .order('created_at', { ascending: false });
      const notesHtml = notes?.length
        ? notes.map((note) => `<div class="border rounded-3 p-2 mb-2"><small class="text-secondary">${LIW.formatDate(note.created_at, true)}</small><div>${LIW.escapeHtml(note.note)}</div></div>`).join('')
        : '<p class="text-muted mb-0">No customer updates yet.</p>';
      window.Swal.fire({
        title: LIW.requestNumber(request.request_number),
        html: `<div class="text-start">
          <p><strong>Service:</strong> ${LIW.escapeHtml(serviceName(request.service_id))}</p>
          <p><strong>Subject:</strong> ${LIW.escapeHtml(request.subject)}</p>
          <p><strong>Status:</strong> ${LIW.statusBadge(request.status)}</p>
          <hr>${LIW.detailRows(request.details)}
          <hr><h6>Updates from LIW</h6>${notesHtml}
        </div>`,
        width: 680,
        confirmButtonColor: '#263fa4'
      });
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
    }
  }

  async function init() {
    const auth = await LIW.requireAuth();
    if (!auth) return;
    user = auth.user;
    role = auth.role;
    document.querySelectorAll('[data-staff-link]').forEach((node) => node.classList.toggle('d-none', !['staff', 'admin', 'owner'].includes(role)));
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('documentForm').addEventListener('submit', uploadDocument);
    document.addEventListener('click', handleTableClick);
    document.querySelectorAll('[data-open-tab]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = link.dataset.openTab;
      const trigger = document.querySelector(`[data-bs-target="${target}"]`);
      if (trigger && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(trigger).show();
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    await loadDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
