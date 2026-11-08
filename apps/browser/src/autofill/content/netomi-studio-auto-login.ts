import AutofillScript from "../models/autofill-script";
import { isNetomiStudioLoginUrl } from "../utils/netomi-studio";

type LoginStep = "email" | "password";

export class NetomiStudioAutoLogin {
  private pending: { opids: Set<string>; expiresAt: number } | null = null;
  private readonly submitted = new Set<LoginStep>();
  private stopped = false;
  private readonly interactionEvents = ["pointerdown", "keydown", "input"];

  constructor() {
    for (const event of this.interactionEvents) {
      document.addEventListener(event, this.onInteraction, true);
    }
  }

  onFill(fillScript: AutofillScript): void {
    if (this.stopped || !this.isLoginPage() || this.submitted.has("password")) {
      return;
    }
    this.pending = {
      opids: new Set(
        fillScript.script.filter(([action]) => action === "fill_by_opid").map(([, opid]) => opid),
      ),
      expiresAt: Date.now() + 5000,
    };
  }

  advance(): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    if (this.stopped || !this.isLoginPage() || Date.now() >= pending.expiresAt) {
      this.pending = null;
      return;
    }

    const inputs = Array.from(document.querySelectorAll("input")).filter(
      (input) => !input.disabled && !input.readOnly && this.isVisible(input),
    );
    const passwords = inputs.filter(
      (input) =>
        input.type === "password" ||
        input.autocomplete.toLowerCase().split(/\s+/).includes("current-password"),
    );
    const step: LoginStep = passwords.length ? "password" : "email";
    if (this.submitted.has(step)) {
      return;
    }
    const candidates = (step === "password" ? passwords : inputs).filter(
      (input) =>
        (step === "password" || input.type === "email" || input.type === "text") &&
        !input.autocomplete
          .toLowerCase()
          .split(/\s+/)
          .some((token) => ["new-password", "one-time-code"].includes(token)) &&
        "opid" in input &&
        typeof input.opid === "string" &&
        pending.opids.has(input.opid),
    );
    if (candidates.length !== 1 || (step === "password" && passwords.length !== 1)) {
      return;
    }
    const field = candidates[0];
    const form = field.form;
    if (!field.value || !form || !form.checkValidity() || !this.isSameOriginAction(form.action)) {
      return;
    }

    const label = step === "email" ? /^next$/i : /^(log\s*in|sign\s*in)$/i;
    const buttons = Array.from(document.querySelectorAll("button")).filter(
      (button) =>
        button.form === form &&
        !button.disabled &&
        this.isVisible(button) &&
        label.test(button.textContent?.trim() ?? ""),
    );
    if (buttons.length !== 1) {
      return;
    }
    const button = buttons[0];
    const buttonAction = button.getAttribute("formaction");
    if (buttonAction !== null && !this.isSameOriginAction(buttonAction)) {
      return;
    }

    this.submitted.add(step);
    this.pending = null;
    button.click();
  }

  dispose(): void {
    this.stopped = true;
    this.pending = null;
    for (const event of this.interactionEvents) {
      document.removeEventListener(event, this.onInteraction, true);
    }
  }

  private readonly onInteraction = (event: Event): void => {
    if (event.isTrusted) {
      this.dispose();
    }
  };

  private isLoginPage(): boolean {
    return window.top === window && isNetomiStudioLoginUrl(location.href);
  }

  private isSameOriginAction(action: string): boolean {
    try {
      return new URL(action, document.baseURI).origin === location.origin;
    } catch {
      return false;
    }
  }

  private isVisible(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }
}
