# General Mistakes & Best Practices

## Authentication Controls
- **ALWAYS** clear the input field (e.g., using a clear command or selecting all text and deleting) before typing into a login textbox. The browser state may persist previous attempts, and appending text will cause login failures.
- **NEVER** clear the field *after* typing in the credentials. This will result in submitting an empty form. Ensure the sequence is: Clear -> Type -> Move to next field.
- **TRY** using Javascript execution to click submit buttons if standard clicks or Enter key presses fail during automation. Use `document.querySelectorAll("button[type='submit']")[0].click();` (or specific ID) as a fallback.

## Automation Settings
- **DELAY** Use a maximum of **2 seconds** between actions for local automation. The environment is fast; longer delays are unnecessary.
