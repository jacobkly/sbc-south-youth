/** The old way to copy, for browsers that block the clipboard API. */
function legacyCopy(text: string): boolean {
  const focused = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  // Pinned in view, so selecting it doesn't scroll the page.
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(field);
  field.select();
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    // Selecting the field moved focus off the button, so put it back.
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

/** Copies text to the clipboard. False when the browser won't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}
