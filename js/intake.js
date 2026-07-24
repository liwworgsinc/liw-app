(function intakePage() {
  'use strict';

  const LIW = window.LIW;
  let currentUser = null;
  let services = [];

  function inputForField(field) {
    const id = `field_${field.key}`;
    const required = field.required === false ? '' : 'required';
    const safeLabel = LIW.escapeHtml(field.label || field.key);
    let control = '';

    if (field.type === 'select') {
      control = `<select class="form-select" id="${id}" name="${LIW.escapeHtml(field.key)}" ${required}>
        <option value="">Choose one</option>
        ${(field.options || []).map((option) => `<option value="${LIW.escapeHtml(option)}">${LIW.escapeHtml(option)}</option>`).join('')}
      </select>`;
    } else if (field.type === 'textarea') {
      control = `<textarea class="form-control" id="${id}" name="${LIW.escapeHtml(field.key)}" ${required}></textarea>`;
    } else {
      const allowedTypes = new Set(['text', 'date', 'number', 'email', 'tel', 'url']);
      const type = allowedTypes.has(field.type) ? field.type : 'text';
      control = `<input class="form-control" type="${type}" id="${id}" name="${LIW.escapeHtml(field.key)}" ${required}>`;
    }

    return `<div class="col-md-6 ${field.type === 'textarea' ? 'col-md-12' : ''}">
      <label class="form-label" for="${id}">${safeLabel}</label>
      ${control}
    </div>`;
  }

  function renderFields() {
    const select = document.getElementById('serviceSelect');
    const fieldsContainer = document.getElementById('dynamicFields');
    const service = services.find((item) => item.id === select.value);
    fieldsContainer.innerHTML = service
      ? (service.intake_fields || []).map(inputForField).join('')
      : '<div class="col-12"><p class="text-muted mb-0">Select a service to see the application questions.</p></div>';
    document.getElementById('serviceDescription').textContent = service?.short_description || '';
  }

  async function loadServices() {
    const { data, error } = await LIW.db
      .from('service_catalog')
      .select('id,code,name,short_description,intake_fields')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    services = data || [];

    const select = document.getElementById('serviceSelect');
    select.innerHTML = '<option value="">Choose a service</option>' + services
      .map((service) => `<option value="${service.id}" data-code="${LIW.escapeHtml(service.code)}">${LIW.escapeHtml(service.name)}</option>`)
      .join('');

    const requestedCode = new URLSearchParams(window.location.search).get('service');
    const match = services.find((service) => service.code === requestedCode);
    if (match) select.value = match.id;
    renderFields();
  }

  async function submitRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const service = services.find((item) => item.id === form.service_id.value);
    if (!service) return LIW.notify('warning', 'Choose a service', 'Select the LIW service you need.');

    const details = {};
    (service.intake_fields || []).forEach((field) => {
      const input = form.elements[field.key];
      details[field.key] = input?.value?.trim?.() ?? input?.value ?? '';
    });
    details.preferred_contact = form.preferred_contact.value;
    details.best_contact_time = form.best_contact_time.value.trim();

    LIW.setLoading(true, 'Submitting your service request…');
    try {
      const subject = form.subject.value.trim() || `${service.name} request`;
      const { data, error } = await LIW.db
        .from('service_requests')
        .insert({
          user_id: currentUser.id,
          service_id: service.id,
          subject,
          details,
          status: 'submitted',
          priority: 'normal',
          submitted_at: new Date().toISOString()
        })
        .select('request_number')
        .single();
      if (error) throw error;

      await LIW.notify('success', 'Request submitted', `Your confirmation number is ${LIW.requestNumber(data.request_number)}.`);
      window.location.replace('portal.html');
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Unable to submit request', error.message || 'Please try again.');
    } finally {
      LIW.setLoading(false);
    }
  }

  async function init() {
    const auth = await LIW.requireAuth();
    if (!auth) return;
    currentUser = auth.user;
    document.querySelector('[data-intake-email]').textContent = currentUser.email || '';
    try {
      await loadServices();
    } catch (error) {
      console.error(error);
      await LIW.notify('error', 'Unable to load services', error.message || 'Please refresh the page.');
    }
    document.getElementById('serviceSelect').addEventListener('change', renderFields);
    document.getElementById('intakeForm').addEventListener('submit', submitRequest);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
