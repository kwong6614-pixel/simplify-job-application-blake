import type { TabReadyPayload } from "../shared/messages";
import { showFillLoading } from "./fill-loading";

const PANEL_HOST_ID = "jobapply-ready-panel-host";

let panelDismissed = false;
let fillInProgress = false;

function removePanel() {
  document.getElementById(PANEL_HOST_ID)?.remove();
}

function setPanelMessage(message: string, isError = false) {
  const status = document.querySelector<HTMLElement>("[data-jobapply-status]");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#475569";
}

export function hideReadyPanel() {
  removePanel();
  panelDismissed = false;
}

export function setReadyPanelFilling(inProgress: boolean) {
  fillInProgress = inProgress;
  const button = document.querySelector<HTMLButtonElement>("[data-jobapply-fill]");
  if (!button) return;

  button.disabled = inProgress;
  button.classList.toggle("loading", inProgress);
  button.innerHTML = inProgress
    ? '<span class="fill-spinner" aria-hidden="true"></span><span>Filling...</span>'
    : "Fill application";
}

export function showReadyPanel(state: TabReadyPayload) {
  if (panelDismissed || fillInProgress) return;

  removePanel();

  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483646;";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .panel {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 300px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #c7d2fe;
      background: #ffffff;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.18);
      font-family: Arial, sans-serif;
      color: #0f172a;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .brand {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #4f46e5;
      text-transform: uppercase;
    }
    .close {
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
    }
    .job {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
    }
    .meta {
      margin: 0 0 12px;
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    .fill {
      width: 100%;
      padding: 10px 12px;
      border: none;
      border-radius: 8px;
      background: #4f46e5;
      color: white;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .fill:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .fill.loading {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .fill-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: jobapply-btn-spin 0.75s linear infinite;
    }
    @keyframes jobapply-btn-spin {
      to { transform: rotate(360deg); }
    }
    .status {
      margin: 10px 0 0;
      font-size: 12px;
      color: #475569;
      min-height: 16px;
    }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header">
      <span class="brand">JobApply ready</span>
      <button type="button" class="close" aria-label="Dismiss">×</button>
    </div>
    <p class="job"></p>
    <p class="meta"></p>
    <button type="button" class="fill" data-jobapply-fill>Fill application</button>
    <p class="status" data-jobapply-status></p>
  `;

  const jobEl = panel.querySelector(".job")!;
  const metaEl = panel.querySelector(".meta")!;
  const company = state.job?.company ?? "Matched company";
  const role = state.job?.role ?? "Matched role";
  jobEl.textContent = `${company} — ${role}`;
  metaEl.textContent = `${state.fieldCount} fields on ${state.atsPlatform}. Sheet URL matched.`;

  panel.querySelector(".close")!.addEventListener("click", () => {
    panelDismissed = true;
    removePanel();
  });

  panel.querySelector("[data-jobapply-fill]")!.addEventListener("click", () => {
    void fillFromPanel();
  });

  shadow.append(style, panel);
  document.documentElement.appendChild(host);
}

async function fillFromPanel() {
  if (fillInProgress) return;

  fillInProgress = true;
  setReadyPanelFilling(true);
  showFillLoading("Generating answers from your profile...");
  setPanelMessage("Generating answers and filling fields...");

  try {
    const response = await chrome.runtime.sendMessage({ type: "FILL_THIS_TAB" });
    if (response?.error) {
      setPanelMessage(response.error, true);
    } else {
      const unmatched = (response?.unmatchedFieldIds as string[] | undefined) ?? [];
      setPanelMessage(
        unmatched.length > 0
          ? `Filled. ${unmatched.length} fields still need manual input.`
          : "Filled successfully.",
      );
    }
  } catch (error) {
    setPanelMessage(
      error instanceof Error ? error.message : "Fill failed. Check extension connection.",
      true,
    );
  } finally {
    fillInProgress = false;
    setReadyPanelFilling(false);
  }
}

export function handleTabReadyMessage(state: TabReadyPayload) {
  showReadyPanel(state);
}
