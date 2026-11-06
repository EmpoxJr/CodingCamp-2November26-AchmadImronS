// To-Do List Life Dashboard — Application Logic
// Populated across tasks 2.1 through 10.1

// ─── Shared Utilities ────────────────────────────────────────────────────────

/**
 * StorageUtil — thin wrapper around localStorage with try/catch guards.
 *
 * load(key)       → returns parsed JSON value, or null on any error
 *                   (missing key, malformed JSON, storage unavailable)
 * save(key, value) → serialises to JSON and writes; returns true on success,
 *                   false if the write fails for any reason
 */
const StorageUtil = {
  /**
   * Read and parse a JSON value from localStorage.
   * @param {string} key
   * @returns {*|null} Parsed value, or null on any failure.
   */
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;          // key not present
      return JSON.parse(raw);
    } catch (_err) {
      return null;                             // storage unavailable or bad JSON
    }
  },

  /**
   * Serialise a value and write it to localStorage.
   * @param {string} key
   * @param {*} value
   * @returns {boolean} true on success, false on failure.
   */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;                            // storage full, unavailable, etc.
    }
  },
};

/**
 * generateId — returns a collision-resistant unique string ID.
 * Prefers the built-in crypto.randomUUID() when available;
 * falls back to a timestamp + random suffix for older environments.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: base-36 timestamp + random suffix
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Greeting Widget ─────────────────────────────────────────────────────────

/**
 * GreetingWidget — displays a time-aware greeting, live clock, and date.
 *
 * init()          → grabs DOM refs, calls render(), starts 1-second interval
 * render()        → reads current Date, updates clock, date, and greeting text;
 *                   on any error falls back to "Hello" and hides clock/date
 * _getGreeting(h) → pure function; maps hour (0–23) to greeting string
 */
const GreetingWidget = {
  /** @type {HTMLElement|null} */ _messageEl: null,
  /** @type {HTMLElement|null} */ _timeEl: null,
  /** @type {HTMLElement|null} */ _dateEl: null,

  /**
   * Grab DOM references and start the live-clock interval.
   * Call once after the DOM is ready.
   */
  init() {
    this._messageEl = document.getElementById('greeting-message');
    this._timeEl    = document.getElementById('greeting-time');
    this._dateEl    = document.getElementById('greeting-date');
    this.render();
    setInterval(() => this.render(), 1000);
  },

  /**
   * Read the current time and update all three greeting DOM elements.
   * Falls back to a safe "Hello" state if anything throws.
   */
  render() {
    try {
      const now = new Date();

      // HH:MM:SS — zero-padded
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeString = `${hh}:${mm}:${ss}`;

      // "DayName, MonthName DD, YYYY"
      const dayNames   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      const day   = dayNames[now.getDay()];
      const month = monthNames[now.getMonth()];
      const date  = String(now.getDate()).padStart(2, '0');
      const year  = now.getFullYear();
      const dateString = `${day}, ${month} ${date}, ${year}`;

      this._timeEl.textContent    = timeString;
      this._timeEl.setAttribute('datetime', timeString);
      this._dateEl.textContent    = dateString;
      // Requirement 12.2 — append ", {name}" when a name is saved
      const greeting = this._getGreeting(now.getHours());
      const name = (typeof UserNameWidget !== 'undefined' && UserNameWidget._name)
        ? UserNameWidget._name
        : '';
      this._messageEl.textContent = name ? `${greeting}, ${name}` : greeting;
    } catch (_err) {
      // Graceful degradation
      if (this._messageEl) this._messageEl.textContent = 'Hello';
      if (this._timeEl)    this._timeEl.style.display  = 'none';
      if (this._dateEl)    this._dateEl.style.display   = 'none';
    }
  },

  /**
   * Map an hour (integer 0–23) to a greeting string.
   * @param {number} hour
   * @returns {string}
   */
  _getGreeting(hour) {
    if (hour >= 5  && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    if (hour >= 18 && hour <= 21) return 'Good Evening';
    return 'Good Night'; // 22–23 and 0–4
  },
};

// ─── Focus Timer Widget ──────────────────────────────────────────────────────

/**
 * FocusTimerWidget — Pomodoro-style 25-minute countdown timer.
 *
 * init()            → sets initial state, grabs DOM refs, wires button listeners
 * _start()          → no-op if already running; if at 0:00 resets to 1500 first;
 *                     starts a 1 Hz setInterval that calls _tick()
 * _stop()           → clears the interval, sets running = false, re-renders
 * _reset()          → _stop() + restore 1500 seconds + _render() + _hideEndMessage()
 * _tick()           → decrements totalSeconds; at 0 calls _stop() + _showEndMessage();
 *                     otherwise calls _render()
 * _render()         → formats totalSeconds as zero-padded MM:SS into #timer-display
 * _showEndMessage() → makes #timer-end-message visible
 * _hideEndMessage() → hides  #timer-end-message
 */
const FocusTimerWidget = {
  // ── Internal state ──────────────────────────────────────────────────────────
  _totalSeconds: 1500,
  _running:      false,
  _intervalId:   null,

  // ── DOM references ──────────────────────────────────────────────────────────
  /** @type {HTMLElement|null} */ _displayEl:    null,
  /** @type {HTMLElement|null} */ _endMessageEl: null,
  /** @type {HTMLButtonElement|null} */ _startBtn: null,
  /** @type {HTMLButtonElement|null} */ _stopBtn:  null,
  /** @type {HTMLButtonElement|null} */ _resetBtn: null,

  /**
   * Grab DOM references, perform an initial render, and attach button listeners.
   * Call once after the DOM is ready.
   */
  init() {
    this._displayEl    = document.getElementById('timer-display');
    this._endMessageEl = document.getElementById('timer-end-message');
    this._startBtn     = document.getElementById('timer-start');
    this._stopBtn      = document.getElementById('timer-stop');
    this._resetBtn     = document.getElementById('timer-reset');

    // Render the initial 25:00 display
    this._render();

    // Wire controls
    this._startBtn.addEventListener('click', () => this._start());
    this._stopBtn.addEventListener('click',  () => this._stop());
    this._resetBtn.addEventListener('click', () => this._reset());
  },

  /**
   * Begin the countdown.
   * No-op when already running.
   * If the timer has reached 0:00, resets to 25:00 before starting (Req 2.7).
   */
  _start() {
    if (this._running) return;                // no-op — already counting down

    if (this._totalSeconds === 0) {
      // Requirement 2.7: start from a fresh 25:00 when the session ended
      this._totalSeconds = 1500;
      this._render();
      this._hideEndMessage();
    }

    this._running = true;
    this._intervalId = setInterval(() => this._tick(), 1000);
  },

  /**
   * Pause the countdown, preserving the current remaining time.
   */
  _stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
    this._render();
  },

  /**
   * Stop any active countdown and restore to 25:00.
   */
  _reset() {
    this._stop();
    this._totalSeconds = 1500;
    this._render();
    this._hideEndMessage();
  },

  /**
   * Called once per second while the timer is running.
   * Decrements totalSeconds; triggers end-of-session logic at zero.
   */
  _tick() {
    this._totalSeconds -= 1;

    if (this._totalSeconds === 0) {
      this._stop();           // clears interval + sets running = false + re-renders
      this._showEndMessage();
    } else {
      this._render();
    }
  },

  /**
   * Format totalSeconds as zero-padded MM:SS and push to #timer-display.
   */
  _render() {
    if (!this._displayEl) return;
    const minutes = Math.floor(this._totalSeconds / 60);
    const seconds = this._totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    this._displayEl.textContent = `${mm}:${ss}`;
  },

  /**
   * Show the session-end message (Requirement 2.6).
   */
  _showEndMessage() {
    if (this._endMessageEl) this._endMessageEl.hidden = false;
  },

  /**
   * Hide the session-end message.
   */
  _hideEndMessage() {
    if (this._endMessageEl) this._endMessageEl.hidden = true;
  },
};

// ─── To-Do List Widget ───────────────────────────────────────────────────────

/**
 * TodoListWidget — persistent task list with add, render, complete, and delete.
 *
 * init()               → loads tasks from storage, renders, attaches submit listener
 * _addTask(description) → validates, creates Task, saves, re-renders, clears input
 * _toggleTask(id)      → flips complete flag, saves, re-renders
 * _deleteTask(id)      → removes task by id, saves, re-renders
 * _save()              → persists _tasks to localStorage; shows error on failure
 * _render()            → rebuilds #todo-list from _tasks array
 * _renderTask(task)    → returns a <li> element for one Task
 * _showInputError(msg) → displays msg in #todo-input-error
 * _clearInputError()   → hides #todo-input-error
 */
const TodoListWidget = {
  /** @type {Array<{id: string, description: string, complete: boolean}>} */
  _tasks: [],

  // ── DOM references ──────────────────────────────────────────────────────────
  /** @type {HTMLInputElement|null}  */ _inputEl:      null,
  /** @type {HTMLButtonElement|null} */ _addBtnEl:     null,
  /** @type {HTMLElement|null}       */ _inputErrorEl: null,
  /** @type {HTMLElement|null}       */ _listEl:       null,

  /** Storage key (Requirements 6.1, 6.2) */
  _STORAGE_KEY: 'todo-life-dashboard-tasks',

  /**
   * Load saved tasks, render the list, and wire up the add-task controls.
   * Call once after the DOM is ready.
   */
  init() {
    this._inputEl      = document.getElementById('todo-input');
    this._addBtnEl     = document.getElementById('todo-add-btn');
    this._inputErrorEl = document.getElementById('todo-input-error');
    this._listEl       = document.getElementById('todo-list');

    // Requirement 6.1 / 6.4 / 6.5 — load saved tasks; treat null/invalid as []
    const saved = StorageUtil.load(this._STORAGE_KEY);
    this._tasks = Array.isArray(saved) ? saved : [];

    this._render();

    // Submit on button click
    this._addBtnEl.addEventListener('click', () => {
      this._addTask(this._inputEl.value);
    });

    // Submit on Enter key inside the input field (Requirement 3.1)
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._addTask(this._inputEl.value);
      }
    });
  },

  /**
   * Validate and add a new task.
   * Requirements 3.1–3.6
   * @param {string} rawDescription
   */
  _addTask(rawDescription) {
    const description = rawDescription.trim();

    // Requirement 3.4 — reject empty / whitespace-only input
    if (description.length === 0) {
      this._showInputError('Task description cannot be empty.');
      return;
    }

    // Requirement 3.1 — reject descriptions longer than 500 characters
    if (description.length > 500) {
      this._showInputError('Task description must be 500 characters or fewer.');
      return;
    }

    // Requirement 3.7 — reject duplicate descriptions (case-insensitive)
    if (this._isDuplicate(description)) {
      this._showInputError('A task with this description already exists.');
      return;
    }

    // Requirement 3.2 — create Task with unique id and complete: false
    const task = {
      id:          generateId(),
      description: description,
      complete:    false,
    };

    this._tasks.push(task);

    // Requirement 3.3 — persist
    this._save();

    // Requirement 3.5 — clear input field
    this._inputEl.value = '';
    this._clearInputError();

    this._render();
    this._inputEl.focus();
  },

  /**
   * Toggle the completion state of a task by id (Requirements 5.2, 5.3).
   * @param {string} id
   */
  _toggleTask(id) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return;
    task.complete = !task.complete;
    this._save();
    this._render();
  },

  /**
   * Permanently remove a task by id (Requirement 5.6).
   * Returns focus to the add button after deletion (Requirement 5.5).
   * @param {string} id
   */
  _deleteTask(id) {
    this._tasks = this._tasks.filter(t => t.id !== id);
    this._save();
    this._render();
    // Return focus to the add button so keyboard users have a sensible landing spot
    if (this._addBtnEl) this._addBtnEl.focus();
  },

  /**
   * Check whether any task already has the given description (case-insensitive,
   * trimmed), optionally excluding the task currently being edited.
   *
   * @param {string} description - The description to check (will be trimmed + lowercased).
   * @param {string} [excludeId] - If provided, the task with this id is skipped.
   * @returns {boolean} true if a duplicate exists.
   */
  _isDuplicate(description, excludeId) {
    const normalized = description.trim().toLowerCase();
    return this._tasks.some(
      t => t.id !== excludeId && t.description.trim().toLowerCase() === normalized
    );
  },

  /**
   * Validate and apply an in-place edit to a task's description.
   * Requirements 4.3, 4.4, 4.5
   *
   * On validation failure: shows an inline error on the edit <input>
   * and returns without calling _render(), so the edit state is preserved.
   *
   * On success: mutates the task in _tasks, persists, and re-renders.
   *
   * @param {string} id        - Task id to edit
   * @param {string} newDesc   - Raw value from the edit input
   */
  _editTask(id, newDesc) {
    const description = newDesc.trim();

    // Find the current edit <input> so we can show inline errors (Req 4.5)
    const li = this._listEl
      ? this._listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`)
      : null;
    const editInput = li ? li.querySelector('.todo-edit-input') : null;

    // Requirement 4.5 — reject empty / whitespace-only value
    if (description.length === 0) {
      if (editInput) {
        editInput.setAttribute('aria-invalid', 'true');
        // Reuse or create an inline error node
        let errEl = li.querySelector('.todo-edit-error');
        if (!errEl) {
          errEl = document.createElement('span');
          errEl.className = 'todo-edit-error';
          errEl.setAttribute('role', 'alert');
          errEl.style.color = '#c0392b';
          editInput.insertAdjacentElement('afterend', errEl);
        }
        errEl.textContent = 'Task description cannot be empty.';
        editInput.focus();
      }
      return; // retain edit state, do NOT call _render()
    }

    // Reject descriptions longer than 500 characters
    if (description.length > 500) {
      if (editInput) {
        editInput.setAttribute('aria-invalid', 'true');
        let errEl = li.querySelector('.todo-edit-error');
        if (!errEl) {
          errEl = document.createElement('span');
          errEl.className = 'todo-edit-error';
          errEl.setAttribute('role', 'alert');
          errEl.style.color = '#c0392b';
          editInput.insertAdjacentElement('afterend', errEl);
        }
        errEl.textContent = 'Task description must be 500 characters or fewer.';
        editInput.focus();
      }
      return; // retain edit state
    }

    // Requirement 4.7 — reject duplicate descriptions (case-insensitive, excludes self)
    if (this._isDuplicate(description, id)) {
      if (editInput) {
        editInput.setAttribute('aria-invalid', 'true');
        let errEl = li.querySelector('.todo-edit-error');
        if (!errEl) {
          errEl = document.createElement('span');
          errEl.className = 'todo-edit-error';
          errEl.setAttribute('role', 'alert');
          errEl.style.color = '#c0392b';
          editInput.insertAdjacentElement('afterend', errEl);
        }
        errEl.textContent = 'A task with this description already exists.';
        editInput.focus();
      }
      return; // retain edit state
    }

    // Valid — mutate the task (Req 4.3) and persist (Req 4.4)
    const task = this._tasks.find(t => t.id === id);
    if (task) task.description = description;
    this._save();
    this._render();
  },

  /**
   * Persist _tasks to localStorage.
   * Shows a persistent error message on failure (Requirement 3.6, 5.8).
   */
  _save() {
    const ok = StorageUtil.save(this._STORAGE_KEY, this._tasks);
    if (!ok) {
      // Show a persistent storage-failure message near the list
      let errEl = document.getElementById('todo-storage-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'todo-storage-error';
        errEl.setAttribute('role', 'alert');
        errEl.style.color = '#c0392b';
        this._listEl.insertAdjacentElement('afterend', errEl);
      }
      errEl.textContent = 'Could not save tasks — storage unavailable.';
    } else {
      // Clear any prior storage-error message on successful save
      const errEl = document.getElementById('todo-storage-error');
      if (errEl) errEl.remove();
    }
  },

  /**
   * Rebuild the #todo-list <ul> from the current _tasks array.
   */
  _render() {
    if (!this._listEl) return;
    // Clear existing items
    this._listEl.innerHTML = '';

    this._tasks.forEach(task => {
      this._listEl.appendChild(this._renderTask(task));
    });
  },

  /**
   * Build and return a <li> element for a single Task.
   *
   * Structure:
   *   <li class="todo-item [complete]">
   *     <input type="checkbox" ...>
   *     <span class="todo-desc">…</span>
   *     <button class="todo-edit-btn">Edit</button>
   *     <button class="todo-delete-btn">Delete</button>
   *   </li>
   *
   * @param {{id: string, description: string, complete: boolean}} task
   * @returns {HTMLLIElement}
   */
  _renderTask(task) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (task.complete ? ' complete' : '');
    li.dataset.id = task.id;

    // ── Completion checkbox (toggle) ─────────────────────────────────────────
    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = task.complete;
    checkbox.setAttribute('aria-label', `Mark "${task.description}" as ${task.complete ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', () => this._toggleTask(task.id));

    // ── Description span ─────────────────────────────────────────────────────
    // Requirement 5.2: strikethrough (via .complete CSS class on <li>)
    const span = document.createElement('span');
    span.className   = 'todo-desc';
    span.textContent = task.description;

    // ── Edit button ──────────────────────────────────────────────────────────
    // Placeholder for task 7.1 (edit functionality); wired up there.
    const editBtn = document.createElement('button');
    editBtn.type      = 'button';
    editBtn.className = 'todo-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit task: ${task.description}`);
    // Edit handler will be attached in task 7.1
    editBtn.addEventListener('click', () => this._startEdit(task.id));

    // ── Delete button ─────────────────────────────────────────────────────────
    const deleteBtn = document.createElement('button');
    deleteBtn.type      = 'button';
    deleteBtn.className = 'todo-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${task.description}`);
    deleteBtn.addEventListener('click', () => this._deleteTask(task.id));

    li.append(checkbox, span, editBtn, deleteBtn);
    return li;
  },

  /**
   * Enter inline edit mode for the task with the given id.
   * Requirements 4.1, 4.2
   *
   * - Locates the task's <li> in the DOM.
   * - Replaces the .todo-desc <span> with a pre-filled <input>.
   * - Replaces the Edit button with Save and Cancel buttons.
   * - All other tasks remain unaffected.
   *
   * @param {string} id
   */
  _startEdit(id) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return;

    const li = this._listEl
      ? this._listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`)
      : null;
    if (!li) return;

    // ── Replace description span with an edit <input> ──────────────────────
    const span = li.querySelector('.todo-desc');
    if (!span) return;

    const editInput = document.createElement('input');
    editInput.type      = 'text';
    editInput.className = 'todo-edit-input';
    editInput.value     = task.description;
    editInput.maxLength = 500;
    editInput.setAttribute('aria-label', `Edit description for task: ${task.description}`);
    editInput.setAttribute('aria-describedby', `edit-error-${id}`);

    span.replaceWith(editInput);

    // ── Swap Edit button → Save + Cancel ───────────────────────────────────
    const editBtn = li.querySelector('.todo-edit-btn');
    if (!editBtn) return;

    const saveBtn = document.createElement('button');
    saveBtn.type      = 'button';
    saveBtn.className = 'todo-save-edit-btn';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', 'Save edit');
    saveBtn.addEventListener('click', () => this._editTask(id, editInput.value));

    const cancelBtn = document.createElement('button');
    cancelBtn.type      = 'button';
    cancelBtn.className = 'todo-cancel-edit-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('aria-label', 'Cancel edit');
    cancelBtn.addEventListener('click', () => this._render());  // Req 4.6 — discard, restore

    editBtn.replaceWith(saveBtn, cancelBtn);

    // Support saving with Enter key inside the edit input
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  this._editTask(id, editInput.value);
      if (e.key === 'Escape') this._render(); // Req 4.6
    });

    // Focus the edit input immediately (Req 4.2)
    editInput.focus();
    editInput.select();
  },

  /**
   * Show an error message below the input field (Requirement 3.4).
   * @param {string} msg
   */
  _showInputError(msg) {
    if (!this._inputErrorEl) return;
    this._inputErrorEl.textContent = msg;
    this._inputErrorEl.hidden = false;
  },

  /**
   * Hide the input error message.
   */
  _clearInputError() {
    if (!this._inputErrorEl) return;
    this._inputErrorEl.hidden = true;
    this._inputErrorEl.textContent = '';
  },
};

// ─── Quick Links Widget ───────────────────────────────────────────────────────

/**
 * QuickLinksWidget — persistent list of user-defined hyperlinks.
 *
 * init()              → loads links from storage, renders, attaches form listeners
 * _addLink(label,url) → validates both fields and URL scheme; creates Link, saves, re-renders
 * _deleteLink(id)     → removes Link by id, saves, re-renders
 * _render()           → rebuilds #links-list from _links array
 * _renderLink(link)   → returns a container element for one Link
 * _save()             → persists _links to localStorage; shows error on failure
 * _showFormError(msg) → displays msg in #link-form-error
 * _clearFormError()   → hides #link-form-error
 */
const QuickLinksWidget = {
  /** @type {Array<{id: string, label: string, url: string}>} */
  _links: [],

  // ── DOM references ──────────────────────────────────────────────────────────
  /** @type {HTMLInputElement|null}  */ _labelInputEl:  null,
  /** @type {HTMLInputElement|null}  */ _urlInputEl:    null,
  /** @type {HTMLButtonElement|null} */ _addBtnEl:      null,
  /** @type {HTMLElement|null}       */ _formErrorEl:   null,
  /** @type {HTMLElement|null}       */ _listEl:        null,

  /** Storage key (Requirements 8.1, 8.2) */
  _STORAGE_KEY: 'todo-life-dashboard-links',

  /**
   * Load saved links, render the list, and wire up the add-link controls.
   * Call once after the DOM is ready.
   */
  init() {
    this._labelInputEl = document.getElementById('link-label-input');
    this._urlInputEl   = document.getElementById('link-url-input');
    this._addBtnEl     = document.getElementById('link-add-btn');
    this._formErrorEl  = document.getElementById('link-form-error');
    this._listEl       = document.getElementById('links-list');

    // Load saved links; treat null/invalid as []
    const saved = StorageUtil.load(this._STORAGE_KEY);
    this._links = Array.isArray(saved) ? saved : [];

    this._render();

    // Submit on button click
    this._addBtnEl.addEventListener('click', () => {
      this._addLink(this._labelInputEl.value, this._urlInputEl.value);
    });

    // Submit on Enter key inside either input field
    const onEnter = (e) => {
      if (e.key === 'Enter') {
        this._addLink(this._labelInputEl.value, this._urlInputEl.value);
      }
    };
    this._labelInputEl.addEventListener('keydown', onEnter);
    this._urlInputEl.addEventListener('keydown', onEnter);
  },

  /**
   * Validate both fields, then create and persist a new Link.
   * Requirements 7.1–7.4, 8.3–8.5
   * @param {string} rawLabel
   * @param {string} rawUrl
   */
  _addLink(rawLabel, rawUrl) {
    const label = rawLabel.trim();
    const url   = rawUrl.trim();

    // Requirement 8.3 — reject empty label
    if (label.length === 0) {
      this._showFormError('Label cannot be empty.');
      return;
    }

    // Requirement 8.3 — reject empty URL
    if (url.length === 0) {
      this._showFormError('URL cannot be empty.');
      return;
    }

    // Requirement 8.3 — reject URLs not starting with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      this._showFormError('URL must start with http:// or https://');
      return;
    }

    // Valid — create and persist the link (Requirements 7.1, 7.2, 8.1, 8.2)
    const link = {
      id:    generateId(),
      label: label,
      url:   url,
    };

    this._links.push(link);
    this._save();
    this._render();

    // Clear inputs after successful add
    this._labelInputEl.value = '';
    this._urlInputEl.value   = '';
    this._clearFormError();

    // Return focus to label input (accessibility)
    this._labelInputEl.focus();
  },

  /**
   * Remove a link by id and persist the updated list.
   * Requirement 7.3
   * @param {string} id
   */
  _deleteLink(id) {
    this._links = this._links.filter(l => l.id !== id);
    this._save();
    this._render();
    // Return focus to the add button so keyboard users have a sensible landing spot
    if (this._addBtnEl) this._addBtnEl.focus();
  },

  /**
   * Rebuild #links-list from the current _links array.
   */
  _render() {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';

    this._links.forEach(link => {
      this._listEl.appendChild(this._renderLink(link));
    });
  },

  /**
   * Build and return a container element for a single Link.
   *
   * Structure:
   *   <div class="link-item">
   *     <a href="…" target="_blank" rel="noopener noreferrer">label</a>
   *     <button class="link-delete-btn">Delete</button>
   *   </div>
   *
   * @param {{id: string, label: string, url: string}} link
   * @returns {HTMLDivElement}
   */
  _renderLink(link) {
    const container = document.createElement('div');
    container.className = 'link-item';
    container.dataset.id = link.id;

    // Anchor — opens in new tab safely (Requirement 7.2, 8.4)
    const anchor = document.createElement('a');
    anchor.href   = link.url;
    anchor.target = '_blank';
    anchor.rel    = 'noopener noreferrer';
    anchor.textContent = link.label;
    anchor.setAttribute('aria-label', link.label);

    // Delete button (Requirement 7.3)
    const deleteBtn = document.createElement('button');
    deleteBtn.type      = 'button';
    deleteBtn.className = 'link-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${link.label}`);
    deleteBtn.addEventListener('click', () => this._deleteLink(link.id));

    container.append(anchor, deleteBtn);
    return container;
  },

  /**
   * Persist _links to localStorage.
   * Shows a persistent error message on failure (Requirement 8.5).
   */
  _save() {
    const ok = StorageUtil.save(this._STORAGE_KEY, this._links);
    if (!ok) {
      let errEl = document.getElementById('links-storage-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'links-storage-error';
        errEl.setAttribute('role', 'alert');
        errEl.style.color = '#c0392b';
        this._listEl.insertAdjacentElement('afterend', errEl);
      }
      errEl.textContent = 'Could not save links — storage unavailable.';
    } else {
      const errEl = document.getElementById('links-storage-error');
      if (errEl) errEl.remove();
    }
  },

  /**
   * Show a form-level error message (Requirements 8.3).
   * @param {string} msg
   */
  _showFormError(msg) {
    if (!this._formErrorEl) return;
    this._formErrorEl.textContent = msg;
    this._formErrorEl.hidden = false;
  },

  /**
   * Hide the form error message.
   */
  _clearFormError() {
    if (!this._formErrorEl) return;
    this._formErrorEl.hidden = true;
    this._formErrorEl.textContent = '';
  },
};

// ─── Theme Widget ─────────────────────────────────────────────────────────────

/**
 * ThemeWidget — persists and applies a light/dark colour theme.
 *
 * init()          → reads saved theme from storage (defaults to "light"),
 *                   calls _apply(), attaches click listener to #theme-toggle
 * _toggle()       → reads current theme from <html data-theme>, flips it,
 *                   calls _apply() and _save()
 * _apply(theme)   → sets data-theme attribute on <html> and updates the
 *                   #theme-toggle aria-label to reflect the *next* action
 * _save(theme)    → persists theme to localStorage; silent on failure (Req 11.6)
 */
const ThemeWidget = {
  /** Storage key (Requirements 11.3, 11.4) */
  _STORAGE_KEY: 'todo-life-dashboard-theme',

  /** @type {HTMLButtonElement|null} */
  _toggleBtnEl: null,

  /**
   * Read saved theme, apply it, and wire the toggle button.
   * Call once after the DOM is ready (before other widgets).
   */
  init() {
    this._toggleBtnEl = document.getElementById('theme-toggle');

    // Requirement 11.3 — restore saved theme; default to "light"
    const saved = StorageUtil.load(this._STORAGE_KEY);
    const theme = saved === 'dark' ? 'dark' : 'light';

    this._apply(theme);

    if (this._toggleBtnEl) {
      this._toggleBtnEl.addEventListener('click', () => this._toggle());
    }
  },

  /**
   * Flip the current theme and persist it.
   * Requirement 11.1 — clicking the toggle switches between light and dark.
   */
  _toggle() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    this._apply(next);
    this._save(next);
  },

  /**
   * Apply a theme by setting the data-theme attribute on <html> and
   * updating the toggle button's aria-label to describe the *next* action.
   * Requirements 11.2, 11.5
   * @param {string} theme  "light" | "dark"
   */
  _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    if (this._toggleBtnEl) {
      this._toggleBtnEl.setAttribute(
        'aria-label',
        theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      );
    }
  },

  /**
   * Persist the theme to localStorage.
   * Requirement 11.6 — failures are silent (no error UI).
   * @param {string} theme  "light" | "dark"
   */
  _save(theme) {
    StorageUtil.save(this._STORAGE_KEY, theme);
  },
};

// ─── UserName Widget ─────────────────────────────────────────────────────────

/**
 * UserNameWidget — lets the user set a personal name that personalises the greeting.
 *
 * init()          → reads saved name from storage; calls _render(); attaches
 *                   listeners to #name-edit-btn, #name-save-btn, #name-clear-btn
 * _setName(raw)   → trims raw; if empty/whitespace calls _clearName();
 *                   otherwise stores name, calls _save(name) and _render()
 * _clearName()    → sets _name to "", persists "", calls _render()
 * _save(name)     → calls StorageUtil.save; silent on failure (Req 12.8)
 * _render()       → updates #name-display; toggles hidden on #name-edit-form
 */
const UserNameWidget = {
  /** @type {string} Current name; empty string means no name set. */
  _name: '',

  /** Storage key (Requirements 12.3, 12.4) */
  _STORAGE_KEY: 'todo-life-dashboard-name',

  // ── DOM references ──────────────────────────────────────────────────────────
  /** @type {HTMLElement|null}       */ _nameDisplayEl: null,
  /** @type {HTMLButtonElement|null} */ _editBtnEl:     null,
  /** @type {HTMLElement|null}       */ _editFormEl:    null,
  /** @type {HTMLInputElement|null}  */ _nameInputEl:   null,
  /** @type {HTMLButtonElement|null} */ _saveBtnEl:     null,
  /** @type {HTMLButtonElement|null} */ _clearBtnEl:    null,

  /**
   * Load saved name, render, and wire button listeners.
   * Call once after the DOM is ready (Requirement 12.4).
   */
  init() {
    this._nameDisplayEl = document.getElementById('name-display');
    this._editBtnEl     = document.getElementById('name-edit-btn');
    this._editFormEl    = document.getElementById('name-edit-form');
    this._nameInputEl   = document.getElementById('name-input');
    this._saveBtnEl     = document.getElementById('name-save-btn');
    this._clearBtnEl    = document.getElementById('name-clear-btn');

    // Requirement 12.4 — load saved name; treat null/non-string as ""
    const saved = StorageUtil.load(this._STORAGE_KEY);
    this._name = (typeof saved === 'string' && saved.length > 0) ? saved : '';

    this._render();

    // Open the edit form
    if (this._editBtnEl) {
      this._editBtnEl.addEventListener('click', () => {
        if (this._editFormEl) {
          this._editFormEl.hidden = false;
          if (this._nameInputEl) {
            this._nameInputEl.value = this._name;
            this._nameInputEl.focus();
          }
        }
      });
    }

    // Save the name (button click or Enter key)
    if (this._saveBtnEl) {
      this._saveBtnEl.addEventListener('click', () => {
        this._setName(this._nameInputEl ? this._nameInputEl.value : '');
      });
    }

    if (this._nameInputEl) {
      this._nameInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this._setName(this._nameInputEl.value);
        }
        if (e.key === 'Escape') {
          if (this._editFormEl) this._editFormEl.hidden = true;
        }
      });
    }

    // Clear the name
    if (this._clearBtnEl) {
      this._clearBtnEl.addEventListener('click', () => this._clearName());
    }
  },

  /**
   * Validate and store a new name.
   * Requirements 12.2, 12.3, 12.7
   * Whitespace-only input is treated as a clear action (Req 12.7).
   * @param {string} raw
   */
  _setName(raw) {
    const trimmed = (raw || '').trim();

    if (trimmed.length === 0) {
      // Requirement 12.7 — treat empty/whitespace as clear
      this._clearName();
      return;
    }

    this._name = trimmed;
    this._save(trimmed);
    this._render();
  },

  /**
   * Clear the saved name and revert to the generic greeting.
   * Requirement 12.6
   */
  _clearName() {
    this._name = '';
    StorageUtil.save(this._STORAGE_KEY, '');
    this._render();
  },

  /**
   * Persist the name to localStorage.
   * Failures are silent — no error UI (Requirement 12.8).
   * @param {string} name
   */
  _save(name) {
    StorageUtil.save(this._STORAGE_KEY, name);
    // Intentionally no error handling — Req 12.8 mandates silent failure
  },

  /**
   * Update #name-display and manage the visibility of the name-edit form.
   * When a name is set: show it in #name-display and hide the edit form.
   * When no name: show placeholder text and keep/hide form per current state.
   */
  _render() {
    // Update the name display span
    if (this._nameDisplayEl) {
      this._nameDisplayEl.textContent = this._name || '';
    }

    // Hide the edit form after a successful save/clear
    if (this._editFormEl) {
      this._editFormEl.hidden = true;
    }

    // Clear the input field after a save/clear action
    if (this._nameInputEl) {
      this._nameInputEl.value = '';
    }
  },
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  ThemeWidget.init();       // must run first so the theme is applied before other widgets paint
  UserNameWidget.init();    // load saved name before GreetingWidget first render (Req 12.4)
  GreetingWidget.init();
  FocusTimerWidget.init();
  TodoListWidget.init();
  QuickLinksWidget.init();
});
