(function () {
  'use strict';
  const toggle = document.querySelector('.liw-menu-toggle');
  const menu = document.getElementById('publicNav');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open');
    }));
  }
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.liw-services-menu[open]').forEach((details) => {
      if (!details.contains(event.target)) details.removeAttribute('open');
    });
  });
  document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
})();
