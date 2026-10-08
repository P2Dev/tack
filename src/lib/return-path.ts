/** Only routes Tack owns can be used as authentication return destinations. */
export function safeReturnPath(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) {
    return "/";
  }
  try {
    const url = new URL(value, "https://tack.invalid");
    if (url.origin !== "https://tack.invalid" || !["/", "/team", "/settings/api-keys"].includes(url.pathname)) {
      return "/";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export function signInPath(returnTo: string): string {
  const path = safeReturnPath(returnTo);
  return path === "/" ? "/sign-in" : `/sign-in?returnTo=${encodeURIComponent(path)}`;
}
