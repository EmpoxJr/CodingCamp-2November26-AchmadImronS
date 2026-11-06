# Implementation Plan: To-Do List Life Dashboard

## Overview

Implement a fully client-side, single-page productivity dashboard in plain HTML, CSS, and Vanilla JavaScript. The application is split across three files (`index.html`, `css/style.css`, `js/app.js`) and persists all user data to `localStorage`. Each widget is self-contained; a shared `StorageUtil` handles all storage access.

## Tasks

- [x] 1. Project scaffolding
  - [x] 1.1 Create the directory structure and base files
    - Create `index.html` at the workspace root with the standard HTML5 boilerplate, `<link>` to `css/style.css`, and `<script src="js/app.js" defer>`
    - Create empty `css/style.css` and `js/app.js` files
    - Add four widget section placeholders in `index.html`: `#greeting-widget`, `#timer-widget`, `#todo-widget`, `#links-widget`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Shared utilities
  - [x] 2.1 Implement `StorageUtil` and `generateId` in `js/app.js`
    - Write `StorageUtil.load(key)` — returns parsed JSON or `null`; wraps `JSON.parse` and `localStorage.getItem` in `try/catch`
    - Write `StorageUtil.save(key, value)` — serializes with `JSON.stringify`, wraps `localStorage.setItem` in `try/catch`, returns `true` on success and `false` on failure
    - Write `generateId()` — uses `crypto.randomUUID()` with `Date.now().toString(36) + Math.random().toString(36).slice(2)` as fallback
    - _Requirements: 6.3, 6.4, 6.5, 8.6_

  - [ ]* 2.2 Write property test for Task serialization round-trip (Property 2)
    - **Property 2: Task serialization round-trip**
    - Generate random arrays of Task objects; assert `JSON.parse(JSON.stringify(tasks))` deep-equals the original for `id`, `description`, and `complete`
    - Tag: `// Feature: todo-life-dashboard, Property 2: Task serialization round-trip`
    - _Requirements: 6.3_

  - [ ]* 2.3 Write property test for Link serialization round-trip (Property 7)
    - **Property 7: Link serialization round-trip**
    - Generate random arrays of Link objects; assert round-trip equality for `id`, `label`, and `url`
    - Tag: `// Feature: todo-life-dashboard, Property 7: Link serialization round-trip`
    - _Requirements: 8.6_

- [x] 3. GreetingWidget
  - [x] 3.1 Implement `GreetingWidget` in `js/app.js`
    - Add DOM elements to `index.html`: `#greeting-message` (h1), `#greeting-time` (`<time>`), `#greeting-date` (`<p>`)
    - Implement `GreetingWidget.init()` — grabs DOM refs, calls `render()`, starts `setInterval` at 1 Hz
    - Implement `GreetingWidget.render()` — reads `new Date()`, formats HH:MM:SS for `#greeting-time` and "DayName, MonthName DD, YYYY" for `#greeting-date`, calls `_getGreeting(hour)` for `#greeting-message`; wraps in `try/catch` for fallback
    - Implement `GreetingWidget._getGreeting(hour)` — pure function: returns "Good Morning" (5–11), "Good Afternoon" (12–17), "Good Evening" (18–21), "Good Night" (22–23, 0–4)
    - Fallback: display "Hello" and hide time/date elements when `new Date()` throws
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.2 Write property test for greeting classification (Property 1)
    - **Property 1: Greeting classification covers all hours**
    - Generate all 24 integer hour values (0–23); assert `_getGreeting(hour)` returns exactly one of the four expected strings and is consistent with the defined ranges
    - Tag: `// Feature: todo-life-dashboard, Property 1: Greeting classification covers all hours`
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 3.3 Write unit tests for GreetingWidget
    - Test correct date format string for a known `Date` value
    - Test fallback "Hello" state when `new Date()` throws
    - _Requirements: 1.1, 1.2, 1.7_

- [x] 4. FocusTimerWidget
  - [x] 4.1 Implement `FocusTimerWidget` in `js/app.js`
    - Add DOM elements to `index.html`: `#timer-display`, `#timer-start`, `#timer-stop`, `#timer-reset`, `#timer-end-message`
    - Implement internal state: `{ totalSeconds: 1500, running: false, intervalId: null }`
    - Implement `_start()` — no-op if `running === true`; if `totalSeconds === 0`, reset to 1500 first; then start 1 Hz `setInterval` calling `_tick()`
    - Implement `_stop()` — clears `intervalId`, sets `running = false`, calls `_render()`
    - Implement `_reset()` — calls `_stop()`, sets `totalSeconds = 1500`, calls `_render()` and `_hideEndMessage()`
    - Implement `_tick()` — decrements `totalSeconds`; calls `_stop()` + `_showEndMessage()` when `totalSeconds === 0`; else calls `_render()`
    - Implement `_render()` — formats `totalSeconds` as zero-padded MM:SS and sets `#timer-display`
    - Implement `_showEndMessage()` / `_hideEndMessage()` — toggle visibility of `#timer-end-message`
    - Wire `#timer-start`, `#timer-stop`, `#timer-reset` click listeners in `init()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.2 Write property test for timer MM:SS format (Property 9)
    - **Property 9: Timer format is always valid MM:SS**
    - Generate integers 0–1500; assert each formats to a string matching `/^\d{2}:\d{2}$/` with correct MM and SS values
    - Tag: `// Feature: todo-life-dashboard, Property 9: Timer format is always valid MM:SS`
    - _Requirements: 2.3_

  - [ ]* 4.3 Write unit tests for FocusTimerWidget
    - Test start → tick → stop sequence; test reset from mid-count; test start at 00:00 resets to 25:00; test end message visibility at 00:00
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Checkpoint — verify utilities and timer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. TodoListWidget
  - [x] 6.1 Implement `TodoListWidget` core (add, render) in `js/app.js`
    - Add DOM elements to `index.html`: `#todo-input`, `#todo-add-btn`, `#todo-input-error`, `#todo-list`
    - Implement `init()` — loads tasks from `StorageUtil.load("todo-life-dashboard-tasks")`, initializes `_tasks = [] if null`, calls `_render()`, attaches submit listener (button click + Enter key)
    - Implement `_addTask(description)` — trims input, rejects empty/whitespace (`_showInputError`) and >500 chars; creates Task `{ id: generateId(), description, complete: false }`; pushes to `_tasks`; calls `_save()` and `_render()`; clears input field; calls `_clearInputError()`
    - Implement `_render()` — clears `#todo-list`, maps `_tasks` to `_renderTask(task)` and appends each `<li>`
    - Implement `_renderTask(task)` — returns `<li>` with checkbox (toggle), description `<span>`, edit button, delete button; applies strikethrough styling when `task.complete === true`
    - Implement `_save()` — calls `StorageUtil.save`; displays persistent error message on `false` return
    - Implement `_showInputError(msg)` / `_clearInputError()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.4, 6.5_

  - [x] 6.2 Implement `TodoListWidget` edit mode
    - Implement `_editTask(id, newDesc)` — validates non-empty/≤500 chars; mutates matching Task in `_tasks`; calls `_save()` and `_render()`; shows inline error on validation failure (retains original description)
    - When edit button clicked: replace description `<span>` with pre-filled `<input>`, swap edit button for save-edit and cancel-edit buttons
    - When save-edit clicked: call `_editTask(id, inputValue)`
    - When cancel-edit clicked: call `_render()` to restore display without saving
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Implement `TodoListWidget` toggle and delete
    - Implement `_toggleTask(id)` — flips `Task.complete`; calls `_save()` and `_render()`
    - Implement `_deleteTask(id)` — removes Task by `id` from `_tasks`; calls `_save()` and `_render()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 6.4 Write property test — adding a valid task grows the list by one (Property 3)
    - **Property 3: Adding a valid task grows the list by one**
    - Generate non-empty strings ≤500 chars; assert `_tasks.length` increases by exactly 1, new task has `complete = false` and description equals trimmed input
    - Tag: `// Feature: todo-life-dashboard, Property 3: Adding a valid task grows the list by one`
    - _Requirements: 3.2, 3.5_

  - [ ]* 6.5 Write property test — whitespace-only descriptions are always rejected (Property 4)
    - **Property 4: Whitespace-only and empty descriptions are always rejected**
    - Generate strings composed entirely of whitespace characters (including empty string); assert `_tasks` is unchanged and `StorageUtil.save` is not called
    - Tag: `// Feature: todo-life-dashboard, Property 4: Whitespace-only and empty descriptions are always rejected`
    - _Requirements: 3.4, 4.5_

  - [ ]* 6.6 Write property test — completion toggle is its own inverse (Property 5)
    - **Property 5: Completion toggle is its own inverse**
    - Generate tasks with random `complete` boolean values; assert double-toggle restores original `complete` value
    - Tag: `// Feature: todo-life-dashboard, Property 5: Completion toggle is its own inverse`
    - _Requirements: 5.2, 5.3_

  - [ ]* 6.7 Write property test — deleted task is absent from the list (Property 6)
    - **Property 6: Deleted task is absent from the list**
    - Generate task lists containing a task with a known `id`; assert no task with that `id` remains after `_deleteTask(id)`
    - Tag: `// Feature: todo-life-dashboard, Property 6: Deleted task is absent from the list`
    - _Requirements: 5.6_

  - [ ]* 6.8 Write unit tests for TodoListWidget
    - Test: add task renders new `<li>`; edit task updates description; delete removes `<li>`; completed task has strikethrough; storage failure shows error message
    - _Requirements: 3.1–3.6, 4.1–4.6, 5.1–5.8_

- [x] 7. QuickLinksWidget
  - [x] 7.1 Implement `QuickLinksWidget` in `js/app.js`
    - Add DOM elements to `index.html`: `#link-label-input`, `#link-url-input`, `#link-add-btn`, `#link-form-error`, `#links-list`
    - Implement `init()` — loads links from `StorageUtil.load("todo-life-dashboard-links")`; initializes `_links = []` if null; calls `_render()`; attaches form submit listener
    - Implement `_addLink(label, url)` — trims both fields; rejects empty label, empty URL, or URL not starting with `http://` or `https://` (show `_showFormError` with field-specific message); creates Link `{ id: generateId(), label, url }`; pushes to `_links`; calls `_save()` and `_render()`
    - Implement `_deleteLink(id)` — removes Link by `id`; calls `_save()` and `_render()`
    - Implement `_render()` — clears `#links-list`, maps `_links` to `_renderLink(link)` and appends each item
    - Implement `_renderLink(link)` — returns a container with `<a href target="_blank">` displaying label text and a delete button
    - Implement `_save()` — calls `StorageUtil.save`; displays error on failure
    - Implement `_showFormError(msg)` / `_clearFormError()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 7.2 Write property test — invalid link submissions are always rejected (Property 8)
    - **Property 8: Invalid link submissions are always rejected**
    - Generate submissions where label is empty/whitespace-only, or URL does not begin with `http://` or `https://`; assert `_links` is unchanged and `StorageUtil.save` is not called
    - Tag: `// Feature: todo-life-dashboard, Property 8: Invalid link submissions are always rejected`
    - _Requirements: 8.3_

  - [ ]* 7.3 Write unit tests for QuickLinksWidget
    - Test: add link renders anchor; clicking anchor has `target="_blank"`; delete removes link; storage failure shows error
    - _Requirements: 7.1, 7.2, 8.1–8.5_

- [x] 8. Responsive layout and visual design
  - [x] 8.1 Implement responsive grid layout in `css/style.css`
    - Default (mobile-first): single-column stacked layout for all widgets
    - At `min-width: 768px`: CSS Grid or Flexbox two-column layout with Greeting and Timer in one column and Todo and Links in the other (or equivalent two-column arrangement)
    - Ensure all four widget sections are visible and non-overlapping at any viewport width
    - _Requirements: 9.1, 9.5, 9.6_

  - [x] 8.2 Implement visual design in `css/style.css`
    - Apply clean typography (readable font stack, clear size hierarchy for headings vs body text)
    - Style each widget as a distinct card (background, padding, border-radius, subtle shadow)
    - Style task completion: add `text-decoration: line-through` and reduced opacity to `<li>` elements with the `.complete` class
    - Style timer display prominently (large font size)
    - Style link buttons and form inputs consistently
    - _Requirements: 9.2, 5.2_

- [x] 9. Accessibility
  - [x] 9.1 Add ARIA attributes and focus management
    - Add `aria-label` or associated `<label>` elements to all interactive controls (todo input, add buttons, edit/delete/toggle per-task buttons, link label/url inputs, timer buttons)
    - Add `role="alert"` to `#todo-input-error` and `#link-form-error` so screen readers announce validation errors
    - Add `aria-describedby` linking each input to its error message element
    - Implement focus management: after adding a task, return focus to `#todo-input`; after adding a link, return focus to `#link-label-input`; after deleting a task or link, return focus to the relevant add button
    - Add `aria-label` to each generated `<a>` link (label text) and delete button (e.g., "Delete [label]")
    - _Requirements: 9.4 (cross-browser), implied by design accessibility checklist_

- [x] 10. App wiring and integration
  - [x] 10.1 Wire all widget `init()` calls in `js/app.js`
    - Register a `DOMContentLoaded` listener in `app.js`
    - Call `GreetingWidget.init()`, `FocusTimerWidget.init()`, `TodoListWidget.init()`, `QuickLinksWidget.init()` in order inside the listener
    - Ensure `StorageUtil` and `generateId` are defined before any widget code that references them
    - _Requirements: 9.3, 9.4, 10.1_

  - [ ]* 10.2 Write integration tests — init with seeded and empty localStorage
    - Test: pre-seed `localStorage` with valid task and link arrays; call all four `init()` functions; assert widgets render the seeded data without errors
    - Test: clear `localStorage`; call all four `init()` functions; assert all widgets render an empty state without JavaScript errors or visible artifacts
    - _Requirements: 6.1, 6.4, 6.5, 7.3, 7.4_

- [x] 11. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Theme toggle
  - [x] 12.1 Add `#theme-toggle` button to `index.html` in the dashboard header area
    - Add a persistent `<header>` or top-bar `<div>` above the `.dashboard` grid
    - Place `<button id="theme-toggle">` inside it with an initial `aria-label` of "Switch to dark mode"
    - _Requirements: 11.1_

  - [x] 12.2 Add CSS custom properties for light and dark themes in `css/style.css`
    - Define `:root, [data-theme="light"]` block with `--color-bg`, `--color-surface`, `--color-text`, and all other color tokens currently hardcoded
    - Define `[data-theme="dark"]` block overriding the same tokens with dark-mode values
    - Replace all hardcoded colour values in existing rules with `var(--color-*)` references
    - _Requirements: 11.2_

  - [x] 12.3 Implement `ThemeWidget` in `js/app.js`
    - Implement `ThemeWidget.init()` — reads saved theme from `StorageUtil.load("todo-life-dashboard-theme")`, defaults to `"light"`, calls `_apply()`, attaches click listener to `#theme-toggle`
    - Implement `ThemeWidget._toggle()` — reads `document.documentElement.dataset.theme`, flips to opposite value, calls `_apply()` and `_save()`
    - Implement `ThemeWidget._apply(theme)` — sets `document.documentElement.setAttribute("data-theme", theme)` and updates `#theme-toggle` `aria-label` accordingly
    - Implement `ThemeWidget._save(theme)` — calls `StorageUtil.save("todo-life-dashboard-theme", theme)`; no error display on failure (Req 11.6)
    - Call `ThemeWidget.init()` inside the `DOMContentLoaded` listener before other widgets
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 13. Custom greeting name
  - [x] 13.1 Add name-edit UI elements to `index.html` inside `#greeting-widget`
    - Add `<span id="name-display"></span>` to show the current name inline in the greeting area
    - Add `<button id="name-edit-btn">` to open the inline name-edit form
    - Add `<input type="text" id="name-input">`, `<button id="name-save-btn">`, and `<button id="name-clear-btn">` for the name-edit form (hidden by default)
    - _Requirements: 12.1, 12.5_

  - [x] 13.2 Implement `UserNameWidget` in `js/app.js`
    - Implement `UserNameWidget.init()` — reads saved name from `StorageUtil.load("todo-life-dashboard-name")`; calls `_render()`; attaches listeners to `#name-edit-btn`, `#name-save-btn`, `#name-clear-btn`
    - Implement `UserNameWidget._setName(raw)` — trims `raw`; if empty/whitespace calls `_clearName()`; otherwise stores name, calls `_save(name)` and `_render()`
    - Implement `UserNameWidget._clearName()` — sets name to `""`, calls `StorageUtil.save("todo-life-dashboard-name", "")`, calls `_render()`
    - Implement `UserNameWidget._save(name)` — calls `StorageUtil.save("todo-life-dashboard-name", name)`; silent on failure (Req 12.8)
    - Implement `UserNameWidget._render()` — updates `#name-display`; shows/hides edit form
    - Update `GreetingWidget.render()` to append `, {name}` to the greeting string when `UserNameWidget` has a non-empty name (e.g. "Good Morning, Alice")
    - Call `UserNameWidget.init()` inside the `DOMContentLoaded` listener
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 14. Duplicate task prevention
  - [x] 14.1 Add `_isDuplicate(description, excludeId)` to `TodoListWidget` and integrate into `_addTask` and `_editTask`
    - Implement `_isDuplicate(description, excludeId)` — returns `true` if any task in `_tasks` (excluding the task whose `id === excludeId`, if provided) has `task.description.trim().toLowerCase() === description.trim().toLowerCase()`
    - In `_addTask`: after existing validation, call `_isDuplicate(description)` with no `excludeId`; on `true`, call `_showInputError("A task with this description already exists.")` and return
    - In `_editTask`: after existing validation, call `_isDuplicate(description, id)`; on `true`, show inline error "A task with this description already exists." on the edit input and return
    - _Requirements: 3.7, 4.7_

- [x] 15. Final checkpoint — ensure all new features work
  - Verify theme toggle applies immediately and persists across simulated page reloads
  - Verify custom greeting name updates the greeting and persists across simulated page reloads
  - Verify duplicate task rejection fires for both add and edit flows with the exact error message
  - Ensure no regressions in existing task, link, timer, and greeting functionality
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The design's Correctness Properties section defines nine properties; property-based tests use **fast-check** with a minimum of 100 iterations each
- Unit and integration tests are complementary to property-based tests — both are needed for full coverage
- Checkpoints at tasks 5 and 11 validate incremental progress before moving to the next phase
- No build step, bundler, or external runtime dependency is required — the app must work by opening `index.html` directly in a browser

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["10.2"] },
    { "id": 11, "tasks": ["12.1", "13.1", "14.1"] },
    { "id": 12, "tasks": ["12.2", "13.2"] },
    { "id": 13, "tasks": ["12.3"] },
    { "id": 14, "tasks": ["15"] }
  ]
}
```
