import { isNetomiStudioLoginUrl } from "./netomi-studio";

describe("Netomi Studio login scope", () => {
  it.each([
    "https://studio.netomi.com/auth/login",
    "https://studio-dev1.netomi.com/auth/login",
    "https://studio-qa.netomi.com/auth/login?next=%2Fai-agent#email",
    "https://studio-us-east.netomi.com/auth/login",
  ])("accepts %s", (url) => expect(isNetomiStudioLoginUrl(url)).toBe(true));

  it.each([
    "http://studio.netomi.com/auth/login",
    "https://studio.netomi.com:8443/auth/login",
    "https://netomi.com/auth/login",
    "https://support.netomi.com/auth/login",
    "https://notstudio.netomi.com/auth/login",
    "https://studio.netomi.com.evil.example/auth/login",
    "https://studio.evil.netomi.com/auth/login",
    "https://studio.netomi.com@evil.example/auth/login",
    "https://user@studio.netomi.com/auth/login",
    "https://studio.netomi.com/auth/login-other",
    "https://studio.netomi.com/auth/reset",
    "https://studio.netomi.com/ai-agent/home/overview",
    "invalid URL",
  ])("rejects %s", (url) => expect(isNetomiStudioLoginUrl(url)).toBe(false));
});
