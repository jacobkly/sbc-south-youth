/**
 * SHA-256 of a file as lowercase hex. Web Crypto only exists in secure
 * contexts (HTTPS or localhost), so this fails over plain LAN http.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Receipt hashing needs a secure connection (HTTPS or localhost).");
  }
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
