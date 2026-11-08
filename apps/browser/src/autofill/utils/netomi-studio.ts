export function isNetomiStudioLoginUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      /^studio(?:-[a-z0-9]+)*\.netomi\.com$/.test(parsed.hostname) &&
      parsed.pathname === "/auth/login"
    );
  } catch {
    return false;
  }
}
