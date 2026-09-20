import { JSDOM } from 'jsdom';

const DEFAULT_HTML = `<!doctype html>
<html data-theme="dark">
<body>
  <div class="corner corner--bl"></div>
  <div class="corner corner--br"></div>
  <div class="ambient" id="ambient"></div>
  <div class="grain"></div>
  <div class="cursor-dot" id="cursorDot"></div>
  <header class="chrome">
    <a class="chrome__brand" href="#/">RESONANCE</a>
    <div class="chrome__meta">
      <span class="tag" id="workCount">[ ARCHIVE ]</span>
      <button class="theme-toggle" id="themeToggle" type="button" aria-pressed="false"></button>
    </div>
  </header>
  <main id="app"></main>
  <footer class="footer"></footer>
</body>
</html>`;

export function installDom(hash = '') {
  const dom = new JSDOM(DEFAULT_HTML, { url: `http://localhost/${hash}`, pretendToBeVisual: true });
  const { window } = dom;

  window.matchMedia = () => ({
    matches: false,
    media: '',
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.navigator = window.navigator;
  globalThis.localStorage = window.localStorage;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;

  return dom;
}

export function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function change(el) {
  el.dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
}

export function navigate(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event('hashchange'));
}
