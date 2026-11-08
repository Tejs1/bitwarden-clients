import { AutofillMessageCommand } from "../enums/autofill-message.enums";

jest.mock("../utils", () => ({ setupExtensionDisconnectAction: jest.fn() }));

describe("autofiller email-first login", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    document.body.innerHTML = '<form><input type="text" /></form>';
    jest.spyOn(document, "readyState", "get").mockReturnValue("complete");
    jest.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
      Object.assign([new DOMRect(0, 0, 100, 20)], {
        item: (index: number) => (index === 0 ? new DOMRect(0, 0, 100, 20) : null),
      }),
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    document.body.innerHTML = "";
  });

  it.each([
    ["https://studio-dev1.netomi.com/auth/login", 1],
    ["https://studio-dev1.netomi.com/auth/login?next=%2Fai-agent", 1],
    ["https://studio-dev1.netomi.com/ai-agent/home/overview", 0],
    ["https://studio-dev1.netomi.com.evil.example/auth/login", 0],
    ["http://studio-dev1.netomi.com/auth/login", 0],
  ])("retries a newly visible password step only on the DEV1 login: %s", async (url, retries) => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
    await jest.isolateModulesAsync(async () => {
      await import("./autofiller");
    });
    jest.advanceTimersByTime(500);
    const onMessage = jest.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
    onMessage({ command: "fillForm", url }, {}, jest.fn());
    jest.advanceTimersByTime(1500);
    jest.mocked(chrome.runtime.sendMessage).mockClear();

    const password = document.createElement("input");
    password.type = "password";
    document.body.append(password);
    jest.advanceTimersByTime(500);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(retries);
    if (retries) {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        command: AutofillMessageCommand.pageTransitionDetected,
        sender: "autofiller",
      });
    }
    onMessage({ command: "fillForm", url }, {}, jest.fn());
    jest.advanceTimersByTime(2500);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(retries);
  });
});
