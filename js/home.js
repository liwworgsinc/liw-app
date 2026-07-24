(function homePage() {
  'use strict';

  const iconMap = {
    building: 'bi-buildings',
    home: 'bi-house-door',
    calculator: 'bi-calculator',
    chart: 'bi-graph-up-arrow',
    wallet: 'bi-wallet2',
    megaphone: 'bi-megaphone',
    globe: 'bi-globe2',
    glasses: 'bi-eyeglasses',
    contact: 'bi-person-vcard'
  };

  async function loadServices() {
    const container = document.getElementById('servicesGrid');
    if (!container || !window.LIW?.db) return;

    const { data, error } = await window.LIW.db
      .from('service_catalog')
      .select('code,name,short_description,icon')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error(error);
      container.innerHTML = '<div class="col-12"><div class="alert alert-warning">Services are temporarily unavailable. Please call 929-234-2881.</div></div>';
      return;
    }

    container.innerHTML = (data || []).map((service) => `
      <div class="col-md-6 col-xl-4">
        <article class="liw-card service-card">
          <div class="service-icon mb-3"><i class="bi ${iconMap[service.icon] || 'bi-briefcase'}"></i></div>
          <h3 class="h5 fw-bold">${window.LIW.escapeHtml(service.name)}</h3>
          <p class="text-secondary">${window.LIW.escapeHtml(service.short_description)}</p>
          <a class="fw-bold text-decoration-none" href="intake.html?service=${encodeURIComponent(service.code)}">
            Start request <i class="bi bi-arrow-right"></i>
          </a>
        </article>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', loadServices);
})();
