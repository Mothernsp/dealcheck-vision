// Admin authorization: a Clerk user is an admin if their user id is in the
// comma-separated ADMIN_USER_IDS env var. Unset = nobody is admin (safe default).
//   ADMIN_USER_IDS=user_abc123,user_def456
export function isAdminUser(userId) {
  const allow = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Boolean(userId) && allow.includes(userId);
}
