// Real DOM test for ErrorBoundary (jsdom) — run with:
//   npm run test:boundary
//
// Verifies that (1) a component crash renders the friendly fallback
// instead of propagating, (2) "Try again" recovers the app, and
// (3) a changed boundary key (route navigation) clears the error.
import { JSDOM } from 'jsdom';

// ── Build a browser-like environment BEFORE react-dom/client loads ──
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true }
);
global.window = dom.window;
global.document = dom.window.document;
// Node 24 defines a getter-only `global.navigator` — override via defineProperty.
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter } = await import('react-router-dom');
const { default: ErrorBoundary } = await import(
  '../src/shared/components/ErrorBoundary.jsx'
);

// ErrorBoundary logs the caught error to console.error (useful when
// debugging the real app). Silence it here so test output stays readable.
const realConsoleError = console.error;
console.error = () => {};

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

// Child that always throws.
function Boom() {
  throw new Error('kaboom-test');
}

// Child that throws only the first time, then succeeds — lets us prove
// that "Try again" genuinely recovers.
let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('first-render-crash');
  return <div>recovered-content</div>;
}

const container = document.getElementById('root');
const root = createRoot(container);

// ── 1. A crash renders the fallback (does not propagate) ──
await act(async () => {
  root.render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ErrorBoundary key="/dashboard">
        <Boom />
      </ErrorBoundary>
    </MemoryRouter>
  );
});
let text = container.textContent;
check(text.includes('Something went wrong'), 'crash → friendly fallback rendered');
check(text.includes('Try again') && text.includes('Dashboard'), 'recovery buttons present');
check(text.includes('Technical details'), 'collapsible technical details present');

// ── 2. "Try again" recovers once the child stops throwing ──
await act(async () => {
  root.render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ErrorBoundary key="/flaky">
        <Flaky />
      </ErrorBoundary>
    </MemoryRouter>
  );
});
check(
  container.textContent.includes('Something went wrong'),
  'flaky child crashed on first render'
);

shouldThrow = false; // next render will succeed
const retryBtn = [...container.querySelectorAll('button')].find((b) =>
  b.textContent.includes('Try again')
);
check(!!retryBtn, 'found the Try again button');

await act(async () => {
  retryBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
text = container.textContent;
check(!text.includes('Something went wrong'), 'Try again → error cleared');
check(text.includes('recovered-content'), 'app recovered and renders content again');

// ── 3. A new boundary key (i.e. route navigation) resets the error ──
shouldThrow = true;
await act(async () => {
  root.render(
    <MemoryRouter initialEntries={['/payroll']}>
      <ErrorBoundary key="/payroll">
        <Boom />
      </ErrorBoundary>
    </MemoryRouter>
  );
});
check(
  container.textContent.includes('Something went wrong'),
  'error shown on the original route'
);

// Simulate navigating to a different route → different key → fresh boundary
shouldThrow = false;
await act(async () => {
  root.render(
    <MemoryRouter initialEntries={['/tasks']}>
      <ErrorBoundary key="/tasks">
        <Flaky />
      </ErrorBoundary>
    </MemoryRouter>
  );
});
text = container.textContent;
check(!text.includes('Something went wrong'), 'navigation (new key) auto-clears the error');
check(text.includes('recovered-content'), 'new route renders normally after recovery');

console.error = realConsoleError;
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
