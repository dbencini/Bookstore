# Agent Troubleshooting & Debugging Guide

This guide documents critical lessons learned during the implementation of the Author Repair and Background Job systems. Use these strategies to ensure visibility, stability, and speed when debugging complex AI-human collaborative projects.

---

## 🚀 Strategy 1: The Client-Side "Debug Console"
**Problem**: Browsers are often a "black box" for AI agents. Relying on the user's terminal logs is not enough when the issue exists in the UI parser or the data transmission.

**Solution**: Always offer to implement a toggleable diagnostic console directly on the user's dashboard.
- **Implementation**: 
  - Add a hidden `div` with `font-family: monospace`.
  - Create an `addLog(msg)` function that timestamps and appends messages to this div.
  - Log every `fetch()` request, every response status, and the raw payload before parsing.
- **Benefit**: This provides "Internal Telemetry." If a parser fails, the user can see the **Raw Data** immediately, allowing you to fix the regex in one turn.

---

## 🚦 Strategy 2: Protecting Route Integrity
**Problem**: The "Unexpected token `<`" error. This usually happens when a `fetch()` call expecting JSON receives an HTML page instead (like a 404, 500 error, or a Redirect).

**Lessons**:
1.  **Explicit JSON Endpoints**: Never use the same route for an HTML view and a JSON API (e.g., `/admin/jobs` should be the page, `/admin/api/jobs` should be the data).
2.  **Accept Headers**: Always include `headers: { 'Accept': 'application/json' }` in fetch calls.
3.  **Route Collision**: If two routes have the same path, Express will use the first one it finds. Always check for duplicate route definitions across the codebase.

---

## 📊 Strategy 3: Bulletproof Data Parsing
**Problem**: Terminal logs and database summaries are inconsistent. A number might be `1,000,000` in one place and `1 000 000` (with non-breaking spaces) in another.

**Lessons**:
1.  **Ignore "Phase" Labels**: Don't use a global regex that anchors on the start of the string (like `^Phase 3...`). If the backend changes the label to "Step 3" or removes it, your parser breaks.
2.  **Segment-Based Parsing**: Split the summary string by commas or pipes first. Then, look for keywords (Scanned, Fixed, ETA) within those segments.
3.  **Sanitize Before Math**: Always strip non-digits (spaces, commas, symbols) using `.replace(/[^\d]/g, '')` before calling `parseInt()`.
4.  **Keyword Arrays**: Use arrays of keywords (e.g., `['fixed', 'updated', 'matches']`) to find data, as backend wording can evolve.

---

## 🧱 Strategy 4: Maintaining DOM Stability
**Problem**: During large refactors of an EJS or HTML file, it is easy to accidentally delete a "small" invisible container (like `jobControls`) while modifying others.

**Lessons**:
1.  **Reference Checks**: If a script fails with `Cannot read properties of null (reading 'addEventListener')`, you have deleted the target element. 
2.  **ID-First Design**: Always ensure interactive elements have clear, unique IDs that the script anchors to.
3.  **Initialization Order**: Declare global variables (like Modals) at the top of the script, but initialize them inside a `DOMContentLoaded` listener to ensure the DOM is ready.

---

## 🌓 Strategy 5: Dark Mode & Visibility
**Problem**: Status text or "Raw Data" fields can become invisible if they use hardcoded colors or default `text-muted` classes on a dark background.

**Lessons**:
1.  **Explicit Hex Codes**: Use color codes like `#adb5bd` for secondary text—they provide consistent contrast on both light and dark backgrounds.
2.  **Info Colors**: Use `text-info` or `text-primary` for critical labels (`Raw:`, `Sync:`) to make them stand out.
3.  **Transparency Warning**: Avoid `opacity: 0.5` on small text; it often renders the text unreadable in many browser themes.

---

## 🧠 Conclusion
The key to fast resolution is **Visibility**. By moving diagnostics into the UI, you empower both the human and the AI to see the same data stream, turning hours of guessing into minutes of fixing.
