(function intakePage() {
  'use strict';

  const LIW = window.LIW;
  const iconMap = {
    building: 'bi-buildings', home: 'bi-house-door', calculator: 'bi-calculator', chart: 'bi-graph-up-arrow',
    wallet: 'bi-wallet2', megaphone: 'bi-megaphone', globe: 'bi-globe2', glasses: 'bi-eyeglasses', contact: 'bi-person-vcard'
  };

  let currentUser = null;
  let services = [];
  let currentStep = 1;

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
      control = `<textarea class="form-control" id="${id}" name="${LIW.escapeHtml(field.key)}" placeholder="Add the important details LIW should know" ${required}></textarea>`;
    } else {
      const allowedTypes = new Set(['text', 'date', 'number', 'email', 'tel', 'url']);
      const type = allowedTypes.has(field.type) ? field.type : 'text';
      control = `<input class="form-control" type="${type}" id="${id}" name="${LIW.escapeHtml(field.key)}" ${required}>`;
    }

    return `<div class="${field.type === 'textarea' ? 'col-12' : 'col-md-6'}">
      <label class="form-label" for="${id}">${safeLabel}</label>
      ${control}
    </div>`;
  }

  function selectedService() {
    const select = document.getElementById('serviceSelect');
    return services.find((item) => item.id === select.value) || null;
  }

  function renderFields() {
    const service = selectedService();
    const fieldsContainer = document.getElementById('dynamicFields');
    fieldsContainer.innerHTML = service
      ? (service.intake_fields || []).map(inputForField).join('')
      : '<div class="col-12"><p class="text-muted mb-0">Choose a service to see the request questions.</p></div>';

    document.getElementById('serviceDescription').textContent = service?.short_description || '';
    document.getElementById('selectedServiceName').textContent = service?.name || '';
    document.getElementById('serviceSummary').classList.toggle('d-none', !service);
  }

  function renderServiceChoices() {
    const grid = document.getElementById('serviceChoiceGrid');
    grid.innerHTML = services.map((service) => `
      <button class="service-choice" type="button" data-service-choice="${service.id}" aria-pressed="false">
        <span class="service-choice-icon"><i class="bi ${iconMap[service.icon] || 'bi-briefcase'}"></i></span>
        <span><strong>${LIW.escapeHtml(service.name)}</strong><small>${LIW.escapeHtml(service.short_description)}</small></span>
      </button>
    `).join('');
  }

  function selectService(id) {
    const select = document.getElementById('serviceSelect');
    select.value = id;
    document.querySelectorAll('[data-service-choice]').forEach((button) => {
      const selected = button.dataset.serviceChoice === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    renderFields();
  }

  async function loadServices() {
    const { data, error } = await LIW.db
      .from('service_catalog')
      .select('id,code,name,short_description,icon,intake_fields')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    services = data || [];

    const select = document.getElementById('serviceSelect');
    select.innerHTML = '<option value="">Choose a service</option>' + services
      .map((service) => `<option value="${service.id}">${LIW.escapeHtml(service.name)}</option>`)
      .join('');

    renderServiceChoices();
    const requestedCode = new URLSearchParams(window.location.search).get('service');
    const match = services.find((service) => service.code === requestedCode);
    if (match) selectService(match.id);
    else renderFields();
  }

  function stageFields(step) {
    const stage = document.querySelector(`[data-intake-stage="${step}"]`);
    return [...stage.querySelectorAll('input, select, textarea')].filter((field) => !field.disabled && field.type !== 'hidden');
  }

  function validateStep(step) {
    if (step === 1 && !selectedService()) {
      LIW.notify('warning', 'Choose a service', 'Select the LIW service that best matches your goal.');
      return false;
    }
    for (const field of stageFields(step)) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  function collectDetails() {
    const form = document.getElementById('intakeForm');
    const service = selectedService();
    const details = {};
    (service?.intake_fields || []).forEach((field) => {
      const input = form.elements[field.key];
      details[field.key] = input?.value?.trim?.() ?? input?.value ?? '';
    });
    return details;
  }

  function renderReview() {
    const form = document.getElementById('intakeForm');
    const service = selectedService();
    const details = collectDetails();
    const rows = [
      ['Service', service?.name || '—'],
      ['Request title', form.subject.value.trim() || `${service?.name || 'LIW'} request`],
      ...Object.entries(details).filter(([, value]) => value).map(([key, value]) => [key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), value])
    ];
    document.getElementById('intakeReview').innerHTML = rows.map(([label, value]) => `
      <div class="review-row"><span>${LIW.escapeHtml(label)}</span><strong>${LIW.escapeHtml(value)}</strong></div>
    `).join('');
  }

  function showStep(step) {
    currentStep = Math.max(1, Math.min(3, step));
    document.querySelectorAll('[data-intake-stage]').forEach((stage) => stage.classList.toggle('active', Number(stage.dataset.intakeStage) === currentStep));
    document.querySelectorAll('[data-step-tab]').forEach((tab) => {
      const number = Number(tab.dataset.stepTab);
      tab.classList.toggle('active', number === currentStep);
      tab.classList.toggle('complete', number < currentStep);
    });

    const back = document.getElementById('intakeBack');
    const cancel = document.getElementById('intakeCancel');
    const next = document.getElementById('intakeNext');
    const submit = document.getElementById('intakeSubmit');
    back.classList.toggle('d-none', currentStep === 1);
    cancel.classList.toggle('d-none', currentStep !== 1);
    next.classList.toggle('d-none', currentStep === 3);
    submit.classList.toggle('d-none', currentStep !== 3);
    if (currentStep === 3) renderReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!validateStep(3)) return;

    const form = event.currentTarget;
    const service = selectedService();
    if (!service) return LIW.notify('warning', 'Choose a service', 'Select the LIW service you need.');

    const details = collectDetails();
    details.preferred_contact = form.preferred_contact.value;
    details.best_contact_time = form.best_contact_time.value.trim();

    const submit = document.getElementById('intakeSubmit');
    submit.disabled = true;
    LIW.setLoading(true, 'Submitting your LIW service request…');

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

      LIW.setLoading(false);
      await LIW.notify('success', 'Request received', `Your LIW confirmation number is ${LIW.requestNumber(data.request_number)}. The request is now visible in your client portal.`);
      window.location.replace('portal.html');
    } catch (error) {
      console.error(error);
      LIW.setLoading(false);
      await LIW.notify('error', 'Unable to submit request', error.message || 'Please try again or call LIW at 929-234-2881.');
    } finally {
      submit.disabled = false;
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
      await LIW.notify('error', 'Unable to load services', error.message || 'Please refresh the page or call 929-234-2881.');
    }

    document.getElementById('serviceChoiceGrid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-service-choice]');
      if (button) selectService(button.dataset.serviceChoice);
    });
    document.getElementById('intakeNext').addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });
    document.getElementById('intakeBack').addEventListener('click', () => showStep(currentStep - 1));
    document.getElementById('intakeForm').addEventListener('submit', submitRequest);
    showStep(1);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
