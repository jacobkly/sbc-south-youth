/** The same minimum as the portal and the Supabase Auth setting. */
export const MIN_PASSWORD_LENGTH = 12;
// Supabase hashes passwords with bcrypt, which only reads the first 72 bytes.
const MAX_PASSWORD_BYTES = 72;

/** The digits in a reset code, matching `otp_length` in Supabase Auth. */
export const CODE_LENGTH = 6;

export type NewPasswordErrors = { password?: string; confirm?: string };

/** What's wrong with a new password and its confirmation, if anything. */
export function newPasswordErrors({ password, confirm }: { password: string; confirm: string }): NewPasswordErrors {
  if (password.length < MIN_PASSWORD_LENGTH) return { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return { password: "That's too long. Try a shorter one." };
  }
  if (confirm !== password) return { confirm: "The passwords don't match." };
  return {};
}

/** The code's digits, so spaces, dashes, or a pasted sentence still work. */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}
