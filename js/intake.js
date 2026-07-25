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
  let openedFromServicePage = false;

  function safeKey(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function fieldWrapperAttributes(field) {
    if (!field.show_when?.key || !Array.isArray(field.show_when.values)) return '';
    return ` data-show-key="${LIW.escapeHtml(field.show_when.key)}" data-show-values="${encodeURIComponent(JSON.stringify(field.show_when.values))}"`;
  }

  function sharedControlAttributes(field, required) {
    const attrs = [];
    if (required) attrs.push('required', 'data-original-required="true"');
    if (field.placeholder) attrs.push(`placeholder="${LIW.escapeHtml(field.placeholder)}"`);
    if (field.autocomplete) attrs.push(`autocomplete="${LIW.escapeHtml(field.autocomplete)}"`);
    if (field.min !== undefined) attrs.push(`min="${LIW.escapeHtml(field.min)}"`);
    if (field.max !== undefined) attrs.push(`max="${LIW.escapeHtml(field.max)}"`);
    if (field.step !== undefined) attrs.push(`step="${LIW.escapeHtml(field.step)}"`);
    return attrs.join(' ');
  }

  function helpText(field) {
    return field.help ? `<div class="form-text">${LIW.escapeHtml(field.help)}</div>` : '';
  }

  function inputForField(field, index) {
    const type = field.type || 'text';
    const condition = fieldWrapperAttributes(field);

    if (type === 'section') {
      return `<div class="col-12 intake-form-section"${condition}>
        <span class="intake-section-kicker">Service details</span>
        <h3>${LIW.escapeHtml(field.label || 'Additional information')}</h3>
        ${field.help ? `<p>${LIW.escapeHtml(field.help)}</p>` : ''}
      </div>`;
    }

    const key = safeKey(field.key);
    const id = `field_${key}`;
    const required = field.required !== false;
    const safeLabel = LIW.escapeHtml(field.label || field.key);
    const requiredMark = required ? '<span class="required-mark" aria-hidden="true">*</span>' : '<span class="optional-label">Optional</span>';
    const spanClass = field.span === 'full' || type === 'textarea' || ['radio', 'checkboxes'].includes(type) ? 'col-12' : 'col-md-6';
    let control = '';

    if (type === 'select') {
      control = `<select class="form-select" id="${id}" name="${LIW.escapeHtml(field.key)}" ${sharedControlAttributes(field, required)}>
        <option value="">Choose one</option>
        ${(field.options || []).map((option) => `<option value="${LIW.escapeHtml(option)}">${LIW.escapeHtml(option)}</option>`).join('')}
      </select>`;
    } else if (type === 'textarea') {
      const rows = Number(field.rows || 4);
      control = `<textarea class="form-control" id="${id}" name="${LIW.escapeHtml(field.key)}" rows="${rows}" ${sharedControlAttributes(field, required)}></textarea>`;
    } else if (type === 'radio') {
      control = `<div class="choice-card-grid" role="radiogroup" aria-labelledby="${id}_label">
        ${(field.options || []).map((option, optionIndex) => {
          const optionId = `${id}_${optionIndex}`;
          return `<label class="choice-card" for="${optionId}">
            <input type="radio" id="${optionId}" name="${LIW.escapeHtml(field.key)}" value="${LIW.escapeHtml(option)}" ${required ? 'required data-original-required="true"' : ''}>
            <span class="choice-indicator"><i class="bi bi-check-lg"></i></span>
            <span>${LIW.escapeHtml(option)}</span>
          </label>`;
        }).join('')}
      </div>`;
    } else if (type === 'checkboxes') {
      control = `<div class="check-card-grid" ${required ? 'data-group-required="true"' : ''} data-group-label="${safeLabel}">
        ${(field.options || []).map((option, optionIndex) => {
          const optionId = `${id}_${optionIndex}`;
          return `<label class="check-card" for="${optionId}">
            <input type="checkbox" id="${optionId}" name="${LIW.escapeHtml(field.key)}" value="${LIW.escapeHtml(option)}">
            <span class="check-box"><i class="bi bi-check-lg"></i></span>
            <span>${LIW.escapeHtml(option)}</span>
          </label>`;
        }).join('')}
      </div>`;
    } else if (type === 'currency') {
      control = `<div class="input-group currency-control"><span class="input-group-text">$</span><input class="form-control" inputmode="decimal" type="text" id="${id}" name="${LIW.escapeHtml(field.key)}" ${sharedControlAttributes(field, required)}></div>`;
    } else {
      const allowedTypes = new Set(['text', 'date', 'number', 'email', 'tel', 'url']);
      const htmlType = allowedTypes.has(type) ? type : 'text';
      control = `<input class="form-control" type="${htmlType}" id="${id}" name="${LIW.escapeHtml(field.key)}" ${sharedControlAttributes(field, required)}>`;
    }

    return `<div class="${spanClass} intake-field" data-field-index="${index}"${condition}>
      <label class="form-label" id="${id}_label" ${['radio', 'checkboxes'].includes(type) ? '' : `for="${id}"`}>${safeLabel} ${requiredMark}</label>
      ${control}
      ${helpText(field)}
    </div>`;
  }

  function selectedService() {
    const select = document.getElementById('serviceSelect');
    return services.find((item) => item.id === select.value) || null;
  }

  function valuesForKey(key) {
    const form = document.getElementById('intakeForm');
    const controls = [...form.querySelectorAll(`[name="${safeKey(key)}"]`)];
    if (!controls.length) return [];
    const type = controls[0].type;
    if (type === 'checkbox' || type === 'radio') return controls.filter((control) => control.checked).map((control) => control.value);
    return controls.map((control) => control.value).filter(Boolean);
  }

  function restoreRequiredState(wrapper, visible) {
    wrapper.querySelectorAll('input, select, textarea').forEach((control) => {
      control.disabled = !visible;
      if (visible && control.dataset.originalRequired === 'true') control.required = true;
      if (!visible) control.required = false;
    });
  }

  function applyConditionalVisibility() {
    document.querySelectorAll('[data-show-key]').forEach((wrapper) => {
      const key = wrapper.dataset.showKey;
      let allowedValues = [];
      try { allowedValues = JSON.parse(decodeURIComponent(wrapper.dataset.showValues || '[]')); } catch (_) { allowedValues = []; }
      const currentValues = valuesForKey(key);
      const visible = currentValues.some((value) => allowedValues.includes(value));
      wrapper.classList.toggle('d-none', !visible);
      restoreRequiredState(wrapper, visible);
    });
  }

  function renderPreparation(service) {
    const card = document.getElementById('servicePreparationCard');
    const list = document.getElementById('serviceDocumentChecklist');
    const notice = document.getElementById('serviceIntakeNotice');
    if (!service) {
      card.classList.add('d-none');
      return;
    }
    document.getElementById('servicePreparationName').textContent = service.name;
    const items = Array.isArray(service.document_checklist) ? service.document_checklist : [];
    list.innerHTML = items.length
      ? items.map((item) => `<li><i class="bi bi-check2-circle"></i><span>${LIW.escapeHtml(item)}</span></li>`).join('')
      : '<li><i class="bi bi-info-circle"></i><span>LIW will confirm the documents needed after reviewing your request.</span></li>';
    notice.textContent = service.intake_notice || 'Do not submit passwords, bank credentials, or other highly sensitive information in this form.';
    card.classList.remove('d-none');
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
    document.getElementById('serviceFormHeading').textContent = service?.intake_heading || 'Help our team understand the request.';
    document.getElementById('serviceFormIntro').textContent = service?.intake_intro || 'Clear details help LIW prepare the right follow-up and document requirements.';
    document.getElementById('subject').placeholder = service?.subject_placeholder || 'Example: Brief description of your request';
    renderPreparation(service);
    applyConditionalVisibility();
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
      .select('id,code,name,short_description,icon,intake_fields,intake_heading,intake_intro,subject_placeholder,intake_notice,document_checklist')
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
    if (match) {
      openedFromServicePage = true;
      selectService(match.id);
    } else {
      renderFields();
    }
  }

  function stageFields(step) {
    const stage = document.querySelector(`[data-intake-stage="${step}"]`);
    return [...stage.querySelectorAll('input, select, textarea')].filter((field) => !field.disabled && field.type !== 'hidden');
  }

  function validateRequiredGroups(step) {
    const stage = document.querySelector(`[data-intake-stage="${step}"]`);
    const groups = [...stage.querySelectorAll('[data-group-required="true"]')].filter((group) => !group.closest('.d-none'));
    for (const group of groups) {
      if (!group.querySelector('input[type="checkbox"]:checked')) {
        LIW.notify('warning', 'Choose at least one option', `${group.dataset.groupLabel || 'This question'} requires at least one selection.`);
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }
    return true;
  }

  function validateStep(step) {
    if (step === 1 && !selectedService()) {
      LIW.notify('warning', 'Choose a service', 'Select the LIW service that best matches your goal.');
      return false;
    }
    if (!validateRequiredGroups(step)) return false;
    for (const field of stageFields(step)) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  function valueForField(field) {
    if (!field.key || field.type === 'section') return '';
    const form = document.getElementById('intakeForm');
    const controls = [...form.querySelectorAll(`[name="${safeKey(field.key)}"]`)].filter((control) => !control.disabled);
    if (!controls.length) return '';
    if (field.type === 'checkboxes') return controls.filter((control) => control.checked).map((control) => control.value);
    if (field.type === 'radio') return controls.find((control) => control.checked)?.value || '';
    return controls[0].value?.trim?.() ?? controls[0].value ?? '';
  }

  function collectDetails() {
    const service = selectedService();
    const details = {};
    (service?.intake_fields || []).forEach((field) => {
      if (!field.key || field.type === 'section') return;
      const value = valueForField(field);
      if (Array.isArray(value)) {
        if (value.length) details[field.key] = value;
      } else if (value !== '') {
        details[field.key] = value;
      }
    });
    return details;
  }

  function fieldLabel(key) {
    const service = selectedService();
    return service?.intake_fields?.find((field) => field.key === key)?.label || key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderReview() {
    const form = document.getElementById('intakeForm');
    const service = selectedService();
    const details = collectDetails();
    const rows = [
      ['Service', service?.name || '—'],
      ['Request title', form.subject.value.trim() || `${service?.name || 'LIW'} request`],
      ...Object.entries(details).map(([key, value]) => [fieldLabel(key), Array.isArray(value) ? value.join(', ') : value])
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
    details.intake_version = 'tailored-v6';

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
        .select('id,request_number')
        .single();
      if (error) throw error;

      // Create the internal Command Center alert immediately and attempt SMS/email delivery.
      // Alert delivery problems never cancel a valid client request.
      LIW.setLoading(true, 'Notifying the LIW team…');
      try {
        const { error: alertError } = await LIW.db.functions.invoke('new-client-alert', {
          body: { request_id: data.id }
        });
        if (alertError) console.warn('New-client alert delivery was not completed:', alertError);
      } catch (alertError) {
        console.warn('New-client alert delivery was not completed:', alertError);
      }

      LIW.setLoading(false);
      await LIW.notify('success', 'Request received', `Your LIW confirmation number is ${LIW.requestNumber(data.request_number)}. LIW has been notified and the request is now visible in your client portal.`);
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
    document.getElementById('dynamicFields').addEventListener('change', applyConditionalVisibility);
    document.getElementById('dynamicFields').addEventListener('input', applyConditionalVisibility);
    document.getElementById('intakeNext').addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });
    document.getElementById('intakeBack').addEventListener('click', () => showStep(currentStep - 1));
    document.getElementById('intakeForm').addEventListener('submit', submitRequest);
    showStep(openedFromServicePage ? 2 : 1);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
