const acknowledgedInSession = new Set<string>();
const keyFor = (userId: string) => `genfolio:portfolio-notice:v1:${userId}`;

export function hasAcknowledgedPortfolioNotice(userId: string): boolean {
  if (acknowledgedInSession.has(userId)) return true;
  try {
    return localStorage.getItem(keyFor(userId)) === "accepted";
  } catch {
    return false;
  }
}

export function acknowledgePortfolioNotice(userId: string): void {
  acknowledgedInSession.add(userId);
  try {
    localStorage.setItem(keyFor(userId), "accepted");
  } catch {
    // Remember the acknowledgement for this session if storage is unavailable.
  }
}
