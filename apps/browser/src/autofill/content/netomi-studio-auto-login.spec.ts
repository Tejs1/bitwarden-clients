import { mock } from "jest-mock-extended";

import AutofillScript from "../models/autofill-script";

import { NetomiStudioAutoLogin } from "./netomi-studio-auto-login";

describe("Netomi Studio automatic login", () => {
  const originalLocation = window.location;
  const url = "https://studio-dev1.netomi.com/auth/login";
  let login: NetomiStudioAutoLogin;
  let clicks: jest.Mock;
  let listeners: jest.SpyInstance;

  function field(type = "text", autocomplete = "username") {
    document.body.innerHTML = `<form action="${url}"><input type="${type}" autocomplete="${autocomplete}" required /><button type="submit">${type === "password" ? "Log in" : "Next"}</button></form>`;
    const input = document.querySelector("input");
    if (!input) {
      throw new Error("Fixture input missing");
    }
    Object.assign(input, { opid: type });
    document.querySelector("button")?.addEventListener("click", (event) => {
      event.preventDefault();
      clicks();
    });
    return input;
  }

  function fill(opid: string) {
    const script = new AutofillScript();
    script.script = [["fill_by_opid", opid, "fixture-value"]];
    login.onFill(script);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
    jest
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue(
        Object.assign([new DOMRect(0, 0, 100, 20)], { item: () => new DOMRect(0, 0, 100, 20) }),
      );
    clicks = jest.fn();
    listeners = jest.spyOn(document, "addEventListener");
    login = new NetomiStudioAutoLogin();
  });

  afterEach(() => {
    login.dispose();
    jest.restoreAllMocks();
    jest.useRealTimers();
    document.body.innerHTML = "";
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("waits for each fill and clicks Next then Log in only once", () => {
    const email = field();
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
    email.value = "fixture@example.test";
    login.advance();
    login.advance();
    fill("text");
    login.advance();
    expect(clicks).toHaveBeenCalledTimes(1);

    const password = field("password", "current-password");
    login.advance();
    expect(clicks).toHaveBeenCalledTimes(1);
    fill("password");
    password.value = "fixture-password";
    login.advance();
    fill("password");
    login.advance();
    expect(clicks).toHaveBeenCalledTimes(2);
  });

  it("does not submit prefilled fields without an approved fill", () => {
    field().value = "fixture@example.test";
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("does not submit fields that were not targeted by the fill", () => {
    field().value = "fixture@example.test";
    fill("unrelated");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it.each(["disabled", "readOnly"] as const)("does not submit a %s field", (property) => {
    const input = field();
    input.value = "fixture@example.test";
    input[property] = true;
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it.each(["new-password", "section-login new-password", "NEW-PASSWORD", "one-time-code"])(
    "does not submit %s inputs",
    (autocomplete) => {
      field("password", autocomplete).value = "fixture-password";
      fill("password");
      login.advance();
      expect(clicks).not.toHaveBeenCalled();
    },
  );

  it("waits for a disabled button to become enabled", () => {
    field().value = "fixture@example.test";
    const button = document.querySelector("button");
    if (!button) {
      throw new Error("Fixture button missing");
    }
    button.disabled = true;
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
    button.disabled = false;
    login.advance();
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("respects form validation", () => {
    field("email").value = "not-an-email";
    fill("email");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("ignores hidden fields", () => {
    const input = field();
    input.value = "fixture@example.test";
    input.style.visibility = "hidden";
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it.each(["form", "button"])("rejects a cross-origin %s action", (element) => {
    field().value = "fixture@example.test";
    document
      .querySelector(element)
      ?.setAttribute(element === "form" ? "action" : "formaction", "https://other.example/login");
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("does not click an unrelated button outside the filled form", () => {
    field().value = "fixture@example.test";
    document.querySelector("button")?.remove();
    const other = document.createElement("button");
    other.textContent = "Next";
    other.addEventListener("click", clicks);
    document.body.append(other);
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("stops after user interaction", () => {
    field().value = "fixture@example.test";
    fill("text");
    const listener = listeners.mock.calls.find(([event]) => event === "input")?.[1];
    listener(mock<Event>({ isTrusted: true }));
    login.advance();
    fill("text");
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("allows synthetic input events from autofill", () => {
    const input = field();
    fill("text");
    input.value = "fixture@example.test";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    login.advance();
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("expires a fill that never completed", () => {
    const input = field();
    fill("text");
    jest.advanceTimersByTime(5000);
    input.value = "fixture@example.test";
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });

  it("stops if the page navigates away before submission", () => {
    field().value = "fixture@example.test";
    fill("text");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://studio-dev1.netomi.com/auth/reset"),
    });
    login.advance();
    expect(clicks).not.toHaveBeenCalled();
  });
});
