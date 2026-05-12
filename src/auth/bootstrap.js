export function getAuthBootstrapMode({
  clerkPublishableKey,
  convexUrl,
  isOnline = true,
} = {}) {
  if (!clerkPublishableKey || !convexUrl) {
    return { mode: 'local', reason: 'missing-config' };
  }

  if (!isOnline) {
    return { mode: 'local', reason: 'offline' };
  }

  return { mode: 'cloud', reason: 'available' };
}
