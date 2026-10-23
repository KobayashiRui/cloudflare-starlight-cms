(() => {
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = (value) => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let preference = 'system';
  try { preference = valid(localStorage.getItem('website-theme')); } catch {}

  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme;
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const label = theme === 'dark' ? button.dataset.lightLabel : button.dataset.darkLabel;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0e0f12' : '#fafafa';
  }

  root.classList.add('js');
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('website-theme', preference); } catch {}
    apply();
  });
  system.addEventListener('change', apply);
  window.addEventListener('storage', (event) => {
    if (event.key === 'website-theme' || event.key === null) {
      preference = valid(event.key === null ? null : event.newValue);
      apply();
    }
  });
})();
