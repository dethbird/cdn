export function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}
