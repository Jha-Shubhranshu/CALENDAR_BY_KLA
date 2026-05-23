// ─── DOM refs ─────────────────────────────────────────────────────────────────
const elEmailSelect = document.getElementById("email-select");
const elTitle       = document.getElementById("title");
const elCount       = document.getElementById("msg-count");
const elSave        = document.getElementById("save");
const elDownload    = document.getElementById("download");
const elStatus      = document.getElementById("status");
const elEndpoint    = document.getElementById("cfg-endpoint");
const elKey         = document.getElementById("cfg-key");
const elEmailList   = document.getElementById("email-list");
const elNewEmail    = document.getElementById("new-email-input");
const elAddEmail    = document.getElementById("add-email-btn");
const elSaveApi     = document.getElementById("save-api-settings");

// ─── Email helpers ────────────────────────────────────────────────────────────

async function loadEmails() {
  const { savedEmails = [], lastEmail = "" } = await chrome.storage.sync.get(["savedEmails", "lastEmail"]);
  renderEmailDropdown(savedEmails, lastEmail);
  renderEmailList(savedEmails);
  return savedEmails;
}

function renderEmailDropdown(emails, lastSelected = "") {
  elEmailSelect.innerHTML = `<option value="">— select email —</option>`;
  for (const email of emails) {
    const opt = document.createElement("option");
    opt.value = email;
    opt.textContent = email;
    if (email === lastSelected) opt.selected = true;
    elEmailSelect.appendChild(opt);
  }
}

function renderEmailList(emails) {
  if (emails.length === 0) {
    elEmailList.innerHTML = `<span style="font-size:11px;color:#444;">No emails saved yet.</span>`;
    return;
  }
  elEmailList.innerHTML = "";
  for (const email of emails) {
    const chip = document.createElement("div");
    chip.className = "email-chip";
    chip.innerHTML = `<span title="${email}">${email}</span><button title="Remove" data-email="${email}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => removeEmail(email));
    elEmailList.appendChild(chip);
  }
}

async function addEmail(email) {
  email = email.trim().toLowerCase();
  if (!email || !email.includes("@")) return setStatus("Enter a valid email.", "warn");
  const { savedEmails = [] } = await chrome.storage.sync.get("savedEmails");
  if (savedEmails.includes(email)) return setStatus("Already saved.", "warn");
  savedEmails.push(email);
  await chrome.storage.sync.set({ savedEmails, lastEmail: email });
  elNewEmail.value = "";
  await loadEmails();
  elEmailSelect.value = email;
  setStatus("Email added.", "ok");
}

async function addEmailSilent(email) {
  const { savedEmails = [] } = await chrome.storage.sync.get("savedEmails");
  if (savedEmails.includes(email)) return;
  savedEmails.push(email);
  await chrome.storage.sync.set({ savedEmails, lastEmail: email });
  await loadEmails();
}

async function removeEmail(email) {
  const { savedEmails = [], lastEmail } = await chrome.storage.sync.get(["savedEmails", "lastEmail"]);
  const updated = savedEmails.filter(e => e !== email);
  const newLast = lastEmail === email ? "" : lastEmail;
  await chrome.storage.sync.set({ savedEmails: updated, lastEmail: newLast });
  await loadEmails();
  setStatus("Email removed.", "ok");
}

elEmailSelect.addEventListener("change", () => {
  chrome.storage.sync.set({ lastEmail: elEmailSelect.value });
});

// ─── API settings ─────────────────────────────────────────────────────────────

chrome.storage.sync.get(["endpoint", "apiKey"], ({ endpoint, apiKey }) => {
  if (endpoint) elEndpoint.value = endpoint;
  if (apiKey)   elKey.value      = apiKey;
});

elSaveApi.addEventListener("click", () => {
  chrome.storage.sync.set({
    endpoint : elEndpoint.value.trim(),
    apiKey   : elKey.value.trim(),
  }, () => setStatus("API settings saved.", "ok"));
});

// ─── Add email listeners ──────────────────────────────────────────────────────

elAddEmail.addEventListener("click", () => addEmail(elNewEmail.value));
elNewEmail.addEventListener("keydown", e => { if (e.key === "Enter") addEmail(elNewEmail.value); });

// ─── Filename helper ──────────────────────────────────────────────────────────

function slugify(s) {
  return (s || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "conversation";
}

function buildFilename(conv) {
  const title = slugify(conv?.title);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `claude-${title}-${stamp}.json`;
}

// Trigger a download of the given text content as a file.
function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a moment later so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── On popup open ────────────────────────────────────────────────────────────

(async () => {
  await loadEmails();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://claude.ai/chat/")) {
    setStatus("Open a Claude conversation first.", "warn");
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });

    chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_CONVERSATION" }, async (data) => {
      if (chrome.runtime.lastError || !data) {
        setStatus("Could not read the page. Try refreshing.", "err");
        return;
      }
      if (data.error) {
        setStatus(data.error, "err");
        return;
      }

      // New schema: wrapper { conversations: [...], detected_email, title, message_count }
      const conv = data.conversations?.[0];
      if (!conv) {
        setStatus("No conversation found in response.", "err");
        return;
      }

      if (data.detected_email) {
        const { savedEmails = [] } = await chrome.storage.sync.get("savedEmails");
        if (!savedEmails.includes(data.detected_email)) {
          await addEmailSilent(data.detected_email);
        }
        elEmailSelect.value = data.detected_email;
        chrome.storage.sync.set({ lastEmail: data.detected_email });
      }

      elTitle.textContent = data.title || conv.title || "Untitled";
      const totalMessages = data.message_count ?? conv.messages?.length ?? 0;
      const userCount = conv.messages?.filter(m => m.role === "user").length ?? 0;
      elCount.textContent = `${totalMessages} messages (${userCount} turns)`;

      // Stash only the schema-compliant array — that's what gets saved/downloaded.
      elSave.dataset.payload     = JSON.stringify(data.conversations);
      elDownload.dataset.payload = JSON.stringify(data.conversations);
      elSave.disabled            = false;
      elDownload.disabled        = false;
      setStatus("Ready to save.", "ok");
    });
  } catch (err) {
    setStatus("Injection failed: " + err.message, "err");
  }
})();

// ─── Download button ──────────────────────────────────────────────────────────

elDownload.addEventListener("click", () => {
  const raw = elDownload.dataset.payload;
  if (!raw) {
    setStatus("Nothing to download yet.", "warn");
    return;
  }

  try {
    const conversations = JSON.parse(raw);

    // If the user has selected an email, apply it to the `account` field
    // so the downloaded file reflects their choice — same as the server send.
    const selectedEmail = elEmailSelect.value;
    if (selectedEmail) {
      for (const c of conversations) c.account = selectedEmail;
    }

    const filename = buildFilename(conversations[0]);
    const pretty   = JSON.stringify(conversations, null, 2);
    downloadBlob(pretty, filename);
    setStatus(`Downloaded ${filename}`, "ok");
  } catch (err) {
    setStatus("Download failed: " + err.message, "err");
  }
});

// ─── Save button ──────────────────────────────────────────────────────────────

elSave.addEventListener("click", async () => {
  const { endpoint, apiKey } = await chrome.storage.sync.get(["endpoint", "apiKey"]);

  if (!endpoint) {
    setStatus("Set your API endpoint in Settings first.", "warn");
    return;
  }

  const selectedEmail = elEmailSelect.value;
  if (!selectedEmail) {
    setStatus("Select or add an account email first.", "warn");
    return;
  }

  const raw = elSave.dataset.payload;
  if (!raw) return;

  // Payload is the schema-compliant array of conversations.
  const conversations = JSON.parse(raw);

  // Override `account` on each conversation with the selected email.
  for (const c of conversations) {
    c.account = selectedEmail;
  }

  elSave.disabled = true;
  setStatus("Saving…", "");

  try {
    const res = await fetch(endpoint, {
      method  : "POST",
      headers : {
        "Content-Type"  : "application/json",
        "Authorization" : `Bearer ${apiKey || ""}`,
        "X-Source"      : "convo-saver-extension",
        "X-Account"     : selectedEmail,
      },
      body: JSON.stringify(conversations),
    });

    if (res.ok) {
      const body  = await res.json().catch(() => ({}));
      const label = body.deduplicated
        ? "Already exists — new messages appended."
        : "Saved successfully.";
      setStatus(label, "ok");
    } else {
      const err = await res.text().catch(() => res.statusText);
      setStatus(`Server error ${res.status}: ${err}`, "err");
    }
  } catch (err) {
    setStatus("Network error: " + err.message, "err");
  } finally {
    elSave.disabled = false;
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function setStatus(msg, type) {
  elStatus.textContent = msg;
  elStatus.className   =
    type === "ok"   ? "badge badge-ok"   :
    type === "err"  ? "badge badge-err"  :
    type === "warn" ? "badge badge-warn" : "";
}