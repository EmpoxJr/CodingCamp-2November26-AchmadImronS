/**
 * app.test.js — Smoke-test suite for To-Do List Life Dashboard
 *
 * Loads js/app.js into the jsdom environment (via a script-injection shim),
 * then tests each widget's core logic.
 *
 * Run with: npm test  (requires Node.js + npm install)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Load app.js into the jsdom global scope ──────────────────────────────────

const appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// We need a minimal DOM before the script executes.
// jest-environment-jsdom provides `document` and `window` globals.
// Set up the four widget sections expected by the widgets.
function buildDOM() {
  document.body.innerHTML = `
    <section id="greeting-widget">
      <h1 id="greeting-message"></h1>
      <time id="greeting-time"></time>
      <p id="greeting-date"></p>
    </section>
    <section id="timer-widget">
      <div id="timer-display">25:00</div>
      <p id="timer-end-message" hidden></p>
      <button id="timer-start"></button>
      <button id="timer-stop"></button>
      <button id="timer-reset"></button>
    </section>
    <section id="todo-widget">
      <input type="text" id="todo-input" />
      <button id="todo-add-btn"></button>
      <span id="todo-input-error" hidden></span>
      <ul id="todo-list"></ul>
    </section>
    <section id="links-widget">
      <input type="text" id="link-label-input" />
      <input type="text" id="link-url-input" />
      <button id="link-add-btn"></button>
      <span id="link-form-error" hidden></span>
      <div id="links-list"></div>
    </section>
  `;
}

// Inject app.js into the global scope once.
// We use vm.runInThisContext so the globals (StorageUtil, GreetingWidget, …)
// become available on the Jest global object.
function loadApp() {
  // Provide localStorage stub in case jsdom doesn't have one
  if (typeof localStorage === 'undefined') {
    const store = {};
    global.localStorage = {
      getItem:    (k)    => (k in store ? store[k] : null),
      setItem:    (k, v) => { store[k] = String(v); },
      removeItem: (k)    => { delete store[k]; },
      clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
    };
  }

  // crypto.randomUUID stub for Node environments without it
  if (typeof global.crypto === 'undefined') {
    global.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
  }

  vm.runInThisContext(appSrc);
}

// Run once before all tests
beforeAll(() => {
  loadApp();
});

// Reset DOM and localStorage before each test
beforeEach(() => {
  buildDOM();
  localStorage.clear();
  // Reset widget state arrays so tests are independent
  if (typeof TodoListWidget !== 'undefined')  TodoListWidget._tasks = [];
  if (typeof QuickLinksWidget !== 'undefined') QuickLinksWidget._links = [];
});

// ── 1. StorageUtil ───────────────────────────────────────────────────────────

describe('StorageUtil', () => {
  test('save() stores a value and load() retrieves it (round-trip)', () => {
    const data = [{ id: 'abc', description: 'hello', complete: false }];
    const ok = StorageUtil.save('test-key', data);
    expect(ok).toBe(true);

    const loaded = StorageUtil.load('test-key');
    expect(loaded).toEqual(data);
  });

  test('load() returns null for a missing key', () => {
    expect(StorageUtil.load('nonexistent-key')).toBeNull();
  });

  test('load() returns null for malformed JSON', () => {
    localStorage.setItem('bad-key', '{invalid json}');
    expect(StorageUtil.load('bad-key')).toBeNull();
  });

  test('save() returns false when localStorage.setItem throws', () => {
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('quota exceeded'); };
    const result = StorageUtil.save('key', 'value');
    expect(result).toBe(false);
    localStorage.setItem = original;
  });

  test('Task serialization round-trip preserves all fields', () => {
    const tasks = [
      { id: 'id1', description: 'Buy milk', complete: false },
      { id: 'id2', description: 'Write tests', complete: true },
    ];
    StorageUtil.save('tasks', tasks);
    const loaded = StorageUtil.load('tasks');
    expect(loaded).toHaveLength(2);
    loaded.forEach((t, i) => {
      expect(t.id).toBe(tasks[i].id);
      expect(t.description).toBe(tasks[i].description);
      expect(t.complete).toBe(tasks[i].complete);
    });
  });

  test('Link serialization round-trip preserves all fields', () => {
    const links = [
      { id: 'l1', label: 'GitHub', url: 'https://github.com' },
      { id: 'l2', label: 'MDN',    url: 'https://developer.mozilla.org' },
    ];
    StorageUtil.save('links', links);
    const loaded = StorageUtil.load('links');
    expect(loaded).toHaveLength(2);
    loaded.forEach((l, i) => {
      expect(l.id).toBe(links[i].id);
      expect(l.label).toBe(links[i].label);
      expect(l.url).toBe(links[i].url);
    });
  });
});

// ── 2. GreetingWidget._getGreeting ───────────────────────────────────────────

describe('GreetingWidget._getGreeting', () => {
  const VALID = new Set(['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night']);

  test('returns a valid greeting for all 24 hours', () => {
    for (let h = 0; h < 24; h++) {
      expect(VALID).toContain(GreetingWidget._getGreeting(h));
    }
  });

  test('hours 5–11 → "Good Morning"', () => {
    for (let h = 5; h <= 11; h++) {
      expect(GreetingWidget._getGreeting(h)).toBe('Good Morning');
    }
  });

  test('hours 12–17 → "Good Afternoon"', () => {
    for (let h = 12; h <= 17; h++) {
      expect(GreetingWidget._getGreeting(h)).toBe('Good Afternoon');
    }
  });

  test('hours 18–21 → "Good Evening"', () => {
    for (let h = 18; h <= 21; h++) {
      expect(GreetingWidget._getGreeting(h)).toBe('Good Evening');
    }
  });

  test('hours 22–23 and 0–4 → "Good Night"', () => {
    [22, 23, 0, 1, 2, 3, 4].forEach(h => {
      expect(GreetingWidget._getGreeting(h)).toBe('Good Night');
    });
  });
});

// ── 3. FocusTimerWidget._render ──────────────────────────────────────────────

describe('FocusTimerWidget._render', () => {
  beforeEach(() => {
    FocusTimerWidget._displayEl = document.getElementById('timer-display');
  });

  test('formats 1500 seconds as "25:00"', () => {
    FocusTimerWidget._totalSeconds = 1500;
    FocusTimerWidget._render();
    expect(document.getElementById('timer-display').textContent).toBe('25:00');
  });

  test('formats 0 seconds as "00:00"', () => {
    FocusTimerWidget._totalSeconds = 0;
    FocusTimerWidget._render();
    expect(document.getElementById('timer-display').textContent).toBe('00:00');
  });

  test('formats 90 seconds as "01:30"', () => {
    FocusTimerWidget._totalSeconds = 90;
    FocusTimerWidget._render();
    expect(document.getElementById('timer-display').textContent).toBe('01:30');
  });

  test('formats 61 seconds as "01:01"', () => {
    FocusTimerWidget._totalSeconds = 61;
    FocusTimerWidget._render();
    expect(document.getElementById('timer-display').textContent).toBe('01:01');
  });

  test('all values 0–1500 produce a string matching /^\\d{2}:\\d{2}$/', () => {
    for (let s = 0; s <= 1500; s++) {
      FocusTimerWidget._totalSeconds = s;
      FocusTimerWidget._render();
      expect(document.getElementById('timer-display').textContent).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

// ── 4. TodoListWidget ────────────────────────────────────────────────────────

describe('TodoListWidget', () => {
  beforeEach(() => {
    // Wire up DOM refs manually (init() calls the full widget, we want isolation)
    TodoListWidget._inputEl      = document.getElementById('todo-input');
    TodoListWidget._addBtnEl     = document.getElementById('todo-add-btn');
    TodoListWidget._inputErrorEl = document.getElementById('todo-input-error');
    TodoListWidget._listEl       = document.getElementById('todo-list');
    TodoListWidget._tasks        = [];
  });

  // ── _addTask ──────────────────────────────────────────────────────────────

  test('_addTask adds a task with correct fields and complete=false', () => {
    TodoListWidget._addTask('Buy milk');
    expect(TodoListWidget._tasks).toHaveLength(1);
    expect(TodoListWidget._tasks[0].description).toBe('Buy milk');
    expect(TodoListWidget._tasks[0].complete).toBe(false);
    expect(typeof TodoListWidget._tasks[0].id).toBe('string');
    expect(TodoListWidget._tasks[0].id.length).toBeGreaterThan(0);
  });

  test('_addTask trims whitespace from description', () => {
    TodoListWidget._addTask('  trimmed  ');
    expect(TodoListWidget._tasks[0].description).toBe('trimmed');
  });

  test('_addTask grows the list by exactly one', () => {
    TodoListWidget._addTask('First');
    TodoListWidget._addTask('Second');
    expect(TodoListWidget._tasks).toHaveLength(2);
  });

  test('_addTask rejects empty string — list unchanged', () => {
    TodoListWidget._addTask('');
    expect(TodoListWidget._tasks).toHaveLength(0);
  });

  test('_addTask rejects whitespace-only string — list unchanged', () => {
    TodoListWidget._addTask('   ');
    expect(TodoListWidget._tasks).toHaveLength(0);
  });

  test('_addTask rejects a description longer than 500 chars — list unchanged', () => {
    TodoListWidget._addTask('x'.repeat(501));
    expect(TodoListWidget._tasks).toHaveLength(0);
  });

  test('_addTask accepts exactly 500 chars', () => {
    TodoListWidget._addTask('x'.repeat(500));
    expect(TodoListWidget._tasks).toHaveLength(1);
  });

  test('_addTask clears the input field on success', () => {
    TodoListWidget._inputEl.value = 'some task';
    TodoListWidget._addTask('some task');
    expect(TodoListWidget._inputEl.value).toBe('');
  });

  test('_addTask renders a new <li> in the list', () => {
    TodoListWidget._addTask('Rendered task');
    const items = document.querySelectorAll('#todo-list li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Rendered task');
  });

  // ── _toggleTask ───────────────────────────────────────────────────────────

  test('_toggleTask marks an incomplete task as complete', () => {
    TodoListWidget._addTask('Toggle me');
    const id = TodoListWidget._tasks[0].id;
    expect(TodoListWidget._tasks[0].complete).toBe(false);
    TodoListWidget._toggleTask(id);
    expect(TodoListWidget._tasks[0].complete).toBe(true);
  });

  test('_toggleTask marks a complete task as incomplete (double-toggle restores original)', () => {
    TodoListWidget._addTask('Toggle me');
    const id   = TodoListWidget._tasks[0].id;
    const orig = TodoListWidget._tasks[0].complete;
    TodoListWidget._toggleTask(id);
    TodoListWidget._toggleTask(id);
    expect(TodoListWidget._tasks[0].complete).toBe(orig);
  });

  test('_toggleTask re-renders: completed <li> gets .complete class', () => {
    TodoListWidget._addTask('Complete me');
    const id = TodoListWidget._tasks[0].id;
    TodoListWidget._toggleTask(id);
    const li = document.querySelector('#todo-list li');
    expect(li.classList.contains('complete')).toBe(true);
  });

  test('_toggleTask re-renders: uncompleted <li> loses .complete class', () => {
    TodoListWidget._addTask('Complete me');
    const id = TodoListWidget._tasks[0].id;
    TodoListWidget._toggleTask(id); // → complete
    TodoListWidget._toggleTask(id); // → incomplete
    const li = document.querySelector('#todo-list li');
    expect(li.classList.contains('complete')).toBe(false);
  });

  test('_toggleTask is a no-op for an unknown id', () => {
    TodoListWidget._addTask('Real task');
    TodoListWidget._toggleTask('nonexistent-id');
    expect(TodoListWidget._tasks[0].complete).toBe(false);
  });

  // ── _deleteTask ───────────────────────────────────────────────────────────

  test('_deleteTask removes the task from _tasks', () => {
    TodoListWidget._addTask('To delete');
    const id = TodoListWidget._tasks[0].id;
    TodoListWidget._deleteTask(id);
    expect(TodoListWidget._tasks).toHaveLength(0);
  });

  test('_deleteTask removes the <li> from the DOM', () => {
    TodoListWidget._addTask('Render then delete');
    const id = TodoListWidget._tasks[0].id;
    TodoListWidget._deleteTask(id);
    expect(document.querySelectorAll('#todo-list li')).toHaveLength(0);
  });

  test('deleted task id is absent from _tasks', () => {
    TodoListWidget._addTask('Task A');
    TodoListWidget._addTask('Task B');
    const idA = TodoListWidget._tasks[0].id;
    TodoListWidget._deleteTask(idA);
    expect(TodoListWidget._tasks.find(t => t.id === idA)).toBeUndefined();
    expect(TodoListWidget._tasks).toHaveLength(1);
  });

  // ── error messages ────────────────────────────────────────────────────────

  test('_addTask shows error message for empty input', () => {
    TodoListWidget._addTask('');
    const errEl = document.getElementById('todo-input-error');
    expect(errEl.hidden).toBe(false);
    expect(errEl.textContent.length).toBeGreaterThan(0);
  });

  test('_addTask clears error message on successful add', () => {
    TodoListWidget._addTask('');            // trigger error
    TodoListWidget._addTask('Valid task');  // should clear error
    const errEl = document.getElementById('todo-input-error');
    expect(errEl.hidden).toBe(true);
  });

  // ── persistence ───────────────────────────────────────────────────────────

  test('_addTask persists tasks to localStorage', () => {
    TodoListWidget._addTask('Persist me');
    const saved = StorageUtil.load('todo-life-dashboard-tasks');
    expect(saved).not.toBeNull();
    expect(saved).toHaveLength(1);
    expect(saved[0].description).toBe('Persist me');
  });

  test('_deleteTask persists updated list to localStorage', () => {
    TodoListWidget._addTask('Keep');
    TodoListWidget._addTask('Delete me');
    const deleteId = TodoListWidget._tasks[1].id;
    TodoListWidget._deleteTask(deleteId);
    const saved = StorageUtil.load('todo-life-dashboard-tasks');
    expect(saved).toHaveLength(1);
    expect(saved[0].description).toBe('Keep');
  });
});

// ── 5. QuickLinksWidget ──────────────────────────────────────────────────────

describe('QuickLinksWidget', () => {
  beforeEach(() => {
    QuickLinksWidget._labelInputEl = document.getElementById('link-label-input');
    QuickLinksWidget._urlInputEl   = document.getElementById('link-url-input');
    QuickLinksWidget._addBtnEl     = document.getElementById('link-add-btn');
    QuickLinksWidget._formErrorEl  = document.getElementById('link-form-error');
    QuickLinksWidget._listEl       = document.getElementById('links-list');
    QuickLinksWidget._links        = [];
  });

  // ── validation — invalid inputs rejected ─────────────────────────────────

  test('_addLink rejects empty label', () => {
    QuickLinksWidget._addLink('', 'https://example.com');
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('_addLink rejects whitespace-only label', () => {
    QuickLinksWidget._addLink('   ', 'https://example.com');
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('_addLink rejects empty URL', () => {
    QuickLinksWidget._addLink('Example', '');
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('_addLink rejects URL without http:// or https:// scheme', () => {
    QuickLinksWidget._addLink('Example', 'ftp://example.com');
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('_addLink rejects plain domain (no scheme)', () => {
    QuickLinksWidget._addLink('Example', 'example.com');
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('invalid submissions do not call StorageUtil.save', () => {
    const originalSave = StorageUtil.save;
    let saveCalled = false;
    StorageUtil.save = (...args) => { saveCalled = true; return originalSave.apply(StorageUtil, args); };

    QuickLinksWidget._addLink('', 'https://example.com');
    QuickLinksWidget._addLink('Label', 'not-a-url');
    QuickLinksWidget._addLink('Label', '');

    expect(saveCalled).toBe(false);
    StorageUtil.save = originalSave;
  });

  test('invalid submission shows form error message', () => {
    QuickLinksWidget._addLink('', 'https://example.com');
    const errEl = document.getElementById('link-form-error');
    expect(errEl.hidden).toBe(false);
    expect(errEl.textContent.length).toBeGreaterThan(0);
  });

  // ── valid add ─────────────────────────────────────────────────────────────

  test('_addLink adds a link with http:// scheme', () => {
    QuickLinksWidget._addLink('Example HTTP', 'http://example.com');
    expect(QuickLinksWidget._links).toHaveLength(1);
    expect(QuickLinksWidget._links[0].url).toBe('http://example.com');
  });

  test('_addLink adds a link with https:// scheme', () => {
    QuickLinksWidget._addLink('GitHub', 'https://github.com');
    expect(QuickLinksWidget._links).toHaveLength(1);
    expect(QuickLinksWidget._links[0].label).toBe('GitHub');
  });

  test('_addLink renders an anchor with target="_blank"', () => {
    QuickLinksWidget._addLink('MDN', 'https://developer.mozilla.org');
    const anchor = document.querySelector('#links-list a');
    expect(anchor).not.toBeNull();
    expect(anchor.target).toBe('_blank');
    expect(anchor.href).toContain('developer.mozilla.org');
  });

  test('_addLink clears inputs on success', () => {
    QuickLinksWidget._labelInputEl.value = 'GitHub';
    QuickLinksWidget._urlInputEl.value   = 'https://github.com';
    QuickLinksWidget._addLink('GitHub', 'https://github.com');
    expect(QuickLinksWidget._labelInputEl.value).toBe('');
    expect(QuickLinksWidget._urlInputEl.value).toBe('');
  });

  // ── _deleteLink ───────────────────────────────────────────────────────────

  test('_deleteLink removes a link from _links', () => {
    QuickLinksWidget._addLink('Site', 'https://example.com');
    const id = QuickLinksWidget._links[0].id;
    QuickLinksWidget._deleteLink(id);
    expect(QuickLinksWidget._links).toHaveLength(0);
  });

  test('_deleteLink removes the rendered element from the DOM', () => {
    QuickLinksWidget._addLink('Site', 'https://example.com');
    const id = QuickLinksWidget._links[0].id;
    QuickLinksWidget._deleteLink(id);
    expect(document.querySelectorAll('#links-list .link-item')).toHaveLength(0);
  });

  // ── persistence ───────────────────────────────────────────────────────────

  test('_addLink persists links to localStorage', () => {
    QuickLinksWidget._addLink('GitHub', 'https://github.com');
    const saved = StorageUtil.load('todo-life-dashboard-links');
    expect(saved).not.toBeNull();
    expect(saved).toHaveLength(1);
    expect(saved[0].label).toBe('GitHub');
  });
});

// ── 6. Integration — init() with seeded and empty localStorage ───────────────

describe('Integration: init() with seeded localStorage', () => {
  test('TodoListWidget.init() renders seeded tasks from localStorage', () => {
    const tasks = [
      { id: 'seed1', description: 'Seeded task', complete: false },
    ];
    StorageUtil.save('todo-life-dashboard-tasks', tasks);
    TodoListWidget.init();
    const items = document.querySelectorAll('#todo-list li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Seeded task');
  });

  test('TodoListWidget.init() renders empty list when localStorage is empty', () => {
    TodoListWidget.init();
    expect(document.querySelectorAll('#todo-list li')).toHaveLength(0);
  });

  test('QuickLinksWidget.init() renders seeded links from localStorage', () => {
    const links = [
      { id: 'lseed1', label: 'GitHub', url: 'https://github.com' },
    ];
    StorageUtil.save('todo-life-dashboard-links', links);
    QuickLinksWidget.init();
    const anchors = document.querySelectorAll('#links-list a');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].textContent).toBe('GitHub');
  });

  test('QuickLinksWidget.init() renders empty list when localStorage is empty', () => {
    QuickLinksWidget.init();
    expect(document.querySelectorAll('#links-list .link-item')).toHaveLength(0);
  });

  test('TodoListWidget.init() handles malformed localStorage data gracefully', () => {
    localStorage.setItem('todo-life-dashboard-tasks', '{broken json}');
    expect(() => TodoListWidget.init()).not.toThrow();
    expect(document.querySelectorAll('#todo-list li')).toHaveLength(0);
  });
});
