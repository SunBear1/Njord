/**
 * Display helpers for user identity (initials, display name).
 * Extracted so they can be shared between UserMenu and AccountPanel
 * without violating react-refresh/only-export-components.
 */

/** Build 1–2 character initials from a user's name or email. */
export function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return email[0].toUpperCase();
}
