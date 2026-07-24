(function adminPage() {
  'use strict';

  const LIW = window.LIW;
  let user = null;
  let services = [];
  let requests = [];
  let profiles = [];
  let invoices = [];
  let statusChart = null;

  const serviceName = (id) => services.find((service) => service.id === id)?.name || 'LIW Service';
  const profileFor = (id) => profiles.find((profile) => profile.id === id) || {};

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
    document.getElementById('adminStatLeads').textContent = requests.length;
    document.getElementById('adminStatNew').textContent = requests.filter((request) => request.status === 'submitted').length;
    document.getElementById('adminStatActive').textContent = requests.filter((request) => !['completed', 'closed'].includes(request.status)).length;
    document.getElementById('adminStatRevenue').textContent = LIW.formatMoney(
      invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0)
    );
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
      data: { labels, datasets: [{ label: 'Requests', data: values, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
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
      return `<tr>
        <td class="fw-bold">${LIW.requestNumber(request.request_number)}</td>
        <td>
          <div class="fw-semibold">${LIW.escapeHtml(profile.full_name || 'Unnamed client')}</div>
          <small class="text-secondary">${LIW.escapeHtml(profile.email || '')}</small>
        </td>
        <td>${LIW.escapeHtml(serviceName(request.service_id))}</td>
        <td><select class="form-select form-select-sm" data-status-request="${request.id}">${statusOptions(request.status)}</select></td>
        <td><select class="form-select form-select-sm" data-priority-request="${request.id}">${priorityOptions(request.priority)}</select></td>
        <td>${LIW.formatDate(request.created_at)}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-liw" data-admin-view="${request.id}" title="View"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-secondary" data-admin-note="${request.id}" title="Add note"><i class="bi bi-journal-plus"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function loadAdmin() {
    LIW.setLoading(true, 'Loading LIW Command Center…');
    try {
      const [servicesResult, requestsResult, profilesResult, invoicesResult] = await Promise.all([
        LIW.db.from('service_catalog').select('id,name').order('sort_order'),
        LIW.db.from('service_requests').select('*').order('created_at', { ascending: false }),
        LIW.db.from('profiles').select('id,email,full_name,phone,company_name,preferred_contact'),
        LIW.db.from('invoices').select('*').order('created_at', { ascending: false })
      ]);
      const firstError = [servicesResult, requestsResult, profilesResult, invoicesResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;
      services = servicesResult.data || [];
      requests = requestsResult.data || [];
      profiles = profilesResult.data || [];
      invoices = invoicesResult.data || [];

      const serviceFilter = document.getElementById('adminServiceFilter');
      serviceFilter.innerHTML = '<option value="">All services</option>' + services.map((service) => `<option value="${service.id}">${LIW.escapeHtml(service.name)}</option>`).join('');
      renderStats();
      renderRequests();
      renderChart();
      document.querySelector('[data-admin-name]').textContent = user.email || 'LIW Staff';
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Unable to load dashboard', error.message || 'Please refresh the page.');
    } finally {
      LIW.setLoading(false);
    }
  }

  async function updateRequest(id, changes) {
    const original = requests.find((request) => request.id === id);
    if (!original) return;
    Object.assign(original, changes);
    const { error } = await LIW.db.from('service_requests').update(changes).eq('id', id);
    if (error) {
      await LIW.notify('error', 'Update failed', error.message);
      await loadAdmin();
      return;
    }
    LIW.toast('success', 'Request updated');
    renderStats();
    renderChart();
  }

  async function addNote(request) {
    const result = await window.Swal.fire({
      title: `Add note to ${LIW.requestNumber(request.request_number)}`,
      input: 'textarea',
      inputLabel: 'Note',
      inputPlaceholder: 'Enter follow-up details…',
      inputAttributes: { 'aria-label': 'Request note' },
      showCancelButton: true,
      confirmButtonText: 'Save note',
      confirmButtonColor: '#2b3f9f',
      inputValidator: (value) => !value.trim() ? 'Enter a note.' : undefined,
      footer: '<small>Customer visibility can be selected after you continue.</small>'
    });
    if (!result.isConfirmed) return;
    const visibility = await window.Swal.fire({
      title: 'Can the customer see this note?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, customer can see it',
      cancelButtonText: 'No, internal only',
      confirmButtonColor: '#2b3f9f'
    });
    LIW.setLoading(true, 'Saving note…');
    const { error } = await LIW.db.from('request_notes').insert({
      request_id: request.id,
      author_id: user.id,
      note: result.value.trim(),
      visible_to_customer: visibility.isConfirmed
    });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to save note', error.message);
    LIW.toast('success', 'Note saved');
  }

  async function showRequest(request) {
    const profile = profileFor(request.user_id);
    const { data: notes, error } = await LIW.db
      .from('request_notes')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at', { ascending: false });
    const notesHtml = error || !notes?.length
      ? '<p class="text-muted mb-0">No notes yet.</p>'
      : notes.map((note) => `<div class="border rounded-3 p-2 mb-2"><small class="text-secondary">${LIW.formatDate(note.created_at, true)} · ${note.visible_to_customer ? 'Customer visible' : 'Internal'}</small><div>${LIW.escapeHtml(note.note)}</div></div>`).join('');

    window.Swal.fire({
      title: LIW.requestNumber(request.request_number),
      html: `<div class="text-start">
        <div class="row g-3 mb-3">
          <div class="col-md-6"><strong>Client</strong><br>${LIW.escapeHtml(profile.full_name || 'Unnamed')}<br><small>${LIW.escapeHtml(profile.email || '')}<br>${LIW.escapeHtml(profile.phone || '')}</small></div>
          <div class="col-md-6"><strong>Service</strong><br>${LIW.escapeHtml(serviceName(request.service_id))}<br>${LIW.statusBadge(request.status)}</div>
        </div>
        <h6>Request details</h6>${LIW.detailRows(request.details)}
        <hr><h6>Notes</h6>${notesHtml}
      </div>`,
      width: 760,
      confirmButtonColor: '#2b3f9f'
    });
  }

  async function handleAdminActions(event) {
    const statusSelect = event.target.closest('[data-status-request]');
    if (statusSelect && event.type === 'change') return updateRequest(statusSelect.dataset.statusRequest, { status: statusSelect.value });
    const prioritySelect = event.target.closest('[data-priority-request]');
    if (prioritySelect && event.type === 'change') return updateRequest(prioritySelect.dataset.priorityRequest, { priority: prioritySelect.value });

    const viewButton = event.target.closest('[data-admin-view]');
    if (viewButton) {
      const request = requests.find((item) => item.id === viewButton.dataset.adminView);
      if (request) await showRequest(request);
      return;
    }
    const noteButton = event.target.closest('[data-admin-note]');
    if (noteButton) {
      const request = requests.find((item) => item.id === noteButton.dataset.adminNote);
      if (request) await addNote(request);
    }
  }

  async function init() {
    const auth = await LIW.requireAuth({ staffOnly: true });
    if (!auth) return;
    user = auth.user;
    document.getElementById('adminSearch').addEventListener('input', renderRequests);
    document.getElementById('adminStatusFilter').addEventListener('change', renderRequests);
    document.getElementById('adminServiceFilter').addEventListener('change', renderRequests);
    document.addEventListener('change', handleAdminActions);
    document.addEventListener('click', handleAdminActions);
    await loadAdmin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
