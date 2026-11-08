import { AutofillerCommand, AutofillMessageCommand } from "../enums/autofill-message.enums";
import { setupExtensionDisconnectAction } from "../utils";
import { isNetomiStudioLoginUrl } from "../utils/netomi-studio";

import { NetomiStudioAutoLogin } from "./netomi-studio-auto-login";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAutofiller);
} else {
  loadAutofiller();
}

function loadAutofiller() {
  let pageHref: null | string = null;
  let filledThisHref = false;
  let hadStudioPasswordField = false;
  let studioAutoLogin: NetomiStudioAutoLogin | undefined;
  let delayFillTimeout: number;
  let doFillInterval: number | NodeJS.Timeout;
  const handleExtensionDisconnect = () => {
    clearDoFillInterval();
    clearDelayFillTimeout();
    studioAutoLogin?.dispose();
  };
  const handleExtensionMessage = (message: any) => {
    if (message.command === "fillForm" && pageHref === message.url) {
      filledThisHref = true;
      if (
        message.autoSubmitNetomiStudio === true &&
        message.pageDetailsUrl === window.location.href &&
        isNetomiStudioLoginUrl(window.location.href) &&
        window.top === window &&
        message.fillScript
      ) {
        studioAutoLogin ??= new NetomiStudioAutoLogin();
        studioAutoLogin.onFill(message.fillScript);
      }
      return;
    }
    if (message.command === AutofillerCommand.disable) {
      handleExtensionDisconnect();
    }
  };

  setupExtensionEventListeners();
  triggerUserFillOnLoad();

  function triggerUserFillOnLoad() {
    clearDoFillInterval();
    doFillInterval = setInterval(() => doFillIfNeeded(), 500);
  }

  function doFillIfNeeded(force = false) {
    const studioPasswordField = isNetomiStudioLoginUrl(window.location.href)
      ? document.querySelector<HTMLInputElement>(
          'input[type="password"]:not([disabled]):not([readonly])',
        )
      : null;
    const hasStudioPasswordField = !!studioPasswordField?.getClientRects().length;
    const studioPasswordAppeared = hasStudioPasswordField && !hadStudioPasswordField;
    hadStudioPasswordField = hasStudioPasswordField;

    if (force || pageHref !== window.location.href || studioPasswordAppeared) {
      if (!force) {
        // Some websites are slow and rendering all page content. Try to fill again later
        // if we haven't already.
        filledThisHref = false;
        clearDelayFillTimeout();
        delayFillTimeout = window.setTimeout(() => {
          if (!filledThisHref) {
            doFillIfNeeded(true);
          }
        }, 1500);
      }

      pageHref = window.location.href;
      // Report the page transition as a fact. The background buffers it
      // against monitoring state and decides whether it warrants a fill.
      const msg: any = {
        command: AutofillMessageCommand.pageTransitionDetected,
        sender: "autofiller",
      };

      void chrome.runtime.sendMessage(msg);
    }
    studioAutoLogin?.advance();
  }

  function clearDoFillInterval() {
    if (doFillInterval) {
      window.clearInterval(doFillInterval);
    }
  }

  function clearDelayFillTimeout() {
    if (delayFillTimeout) {
      window.clearTimeout(delayFillTimeout);
    }
  }

  function setupExtensionEventListeners() {
    setupExtensionDisconnectAction(handleExtensionDisconnect);
    chrome.runtime.onMessage.addListener(handleExtensionMessage);
  }
}
