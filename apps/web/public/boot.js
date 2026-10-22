// Runs before the app loads: applies the saved theme and language so the first paint is right.
try {
  const saved = JSON.parse(localStorage.getItem('meandu-settings') || '{}').state || {}
  const dark =
    saved.theme === 'dark' ||
    (saved.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  if (saved.lang) document.documentElement.lang = saved.lang
} catch {
  document.documentElement.dataset.theme = 'light'
}
