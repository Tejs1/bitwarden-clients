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

  it.each([true, false])(
    "submits only fills explicitly enabled for Studio: %s",
    async (enabled) => {
      const url = "https://studio-qa.netomi.com/auth/login";
      Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
      document.body.innerHTML = `<form action="${url}"><input type="text" /><button type="submit">Next</button></form>`;
      const input = document.querySelector("input");
      Object.assign(input ?? {}, { opid: "email", value: "fixture@example.test" });
      const click = jest.fn((event: Event) => event.preventDefault());
      document.querySelector("button")?.addEventListener("click", click);
      await jest.isolateModulesAsync(async () => {
        await import("./autofiller");
      });
      jest.advanceTimersByTime(500);
      const onMessage = jest.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
      onMessage(
        {
          command: "fillForm",
          url,
          pageDetailsUrl: url,
          autoSubmitNetomiStudio: enabled,
          fillScript: { script: [["fill_by_opid", "email", "fixture@example.test"]] },
        },
        {},
        jest.fn(),
      );
      jest.advanceTimersByTime(500);
      expect(click).toHaveBeenCalledTimes(enabled ? 1 : 0);
      onMessage({ command: "disableAutofiller" }, {}, jest.fn());
    },
  );

  it.each([
    ["https://studio-dev1.netomi.com/auth/login", 1],
    ["https://studio.netomi.com/auth/login", 1],
    ["https://studio-qa.netomi.com/auth/login", 1],
    ["https://studio-dev1.netomi.com/auth/login?next=%2Fai-agent", 1],
    ["https://studio-dev1.netomi.com/ai-agent/home/overview", 0],
    ["https://studio-dev1.netomi.com.evil.example/auth/login", 0],
    ["http://studio-dev1.netomi.com/auth/login", 0],
  ])("retries a newly visible password step only on Studio logins: %s", async (url, retries) => {
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
