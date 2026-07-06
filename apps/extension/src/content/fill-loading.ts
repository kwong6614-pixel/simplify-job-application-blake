const OVERLAY_HOST_ID = "jobapply-fill-loading-host";

function getOverlayElements(): {
  host: HTMLElement;
  stepEl: HTMLElement;
} | null {
  const host = document.getElementById(OVERLAY_HOST_ID);
  if (!host?.shadowRoot) return null;

  const stepEl = host.shadowRoot.querySelector<HTMLElement>("[data-jobapply-fill-step]");
  if (!stepEl) return null;

  return { host, stepEl };
}

export function showFillLoading(step: string) {
  hideFillLoading();

  const host = document.createElement("div");
  host.id = OVERLAY_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.4);
      font-family: Arial, sans-serif;
    }
    .card {
      min-width: 260px;
      max-width: 320px;
      padding: 22px 24px;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
      text-align: center;
      color: #0f172a;
    }
    .spinner {
      width: 34px;
      height: 34px;
      margin: 0 auto 14px;
      border: 3px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: jobapply-spin 0.75s linear infinite;
    }
    .title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 700;
    }
    .step {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: #475569;
    }
    @keyframes jobapply-spin {
      to { transform: rotate(360deg); }
    }
  `;

  const card = document.createElement("div");
  card.className = "overlay";
  card.innerHTML = `
    <div class="card">
      <div class="spinner" aria-hidden="true"></div>
      <p class="title">Filling application</p>
      <p class="step" data-jobapply-fill-step></p>
    </div>
  `;

  const stepEl = card.querySelector<HTMLElement>("[data-jobapply-fill-step]")!;
  stepEl.textContent = step;

  shadow.append(style, card);
  document.documentElement.appendChild(host);
}

export function updateFillLoading(step: string) {
  const elements = getOverlayElements();
  if (!elements) {
    showFillLoading(step);
    return;
  }

  elements.stepEl.textContent = step;
}

export function hideFillLoading() {
  document.getElementById(OVERLAY_HOST_ID)?.remove();
}
