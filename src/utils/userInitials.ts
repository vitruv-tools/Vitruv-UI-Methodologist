/** Display initials for avatars (not used for security). */
export function getUserInitials(fullName?: string, email?: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '';
    return (first + last).toUpperCase() || 'U';
  }
  if (email) {
    const namePart = email.split('@')[0] ?? '';
    const first = namePart[0] ?? '';
    const last = namePart.at(-1) ?? '';
    return (first + last).toUpperCase() || 'U';
  }
  return 'U';
}
