// ─── One-time injection guard ─────────────────────────────────────────────────
if (!window.__convoSaverInjected) {
window.__convoSaverInjected = true;

// ─── Selectors (used for images + DOM fallback only) ──────────────────────────
const SEL = {
  humanTurn    : '[data-testid="user-message"]',
  assistantTurn: '.font-claude-response',
  emailButton  : 'button[data-testid="user-menu-trigger"]',
  activeTitle  : '[data-testid="chat-title"][aria-current="true"], ' +
                 '[aria-current="page"] [data-testid="chat-title"]',
};

// ─── API helpers ──────────────────────────────────────────────────────────────
async function getOrgId() {
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) {
      const d = JSON.parse(el.textContent);
      const id =
        d?.props?.pageProps?.organization?.uuid ||
        d?.props?.pageProps?.activeOrg?.uuid    ||
        d?.props?.pageProps?.currentOrg?.uuid   ||
        d?.props?.pageProps?.organizationId;
      if (id) return id;
    }
  } catch (_) {}
  try {
    const res = await fetch('/api/organizations', { credentials: 'include' });
    if (res.ok) {
      const orgs = await res.json();
      const id = Array.isArray(orgs) ? orgs[0]?.uuid : orgs?.uuid;
      if (id) return id;
    }
  } catch (_) {}
  return null;
}

async function fetchConversationAPI(orgId, convId) {
  const res = await fetch(
    `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convId}`,
    { credentials: 'include' }
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─── Image extraction ─────────────────────────────────────────────────────────
async function fetchBase64(url) {
  try {
    const res  = await fetch(url, { credentials: 'include' });
    const blob = await res.blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch (_) { return null; }
}

async function extractImages(messageEl) {
  const bubble   = messageEl.closest('[data-user-message-bubble="true"]');
  const turnRoot = bubble?.parentElement?.parentElement;
  if (!turnRoot) return [];
  const imgs = [...turnRoot.querySelectorAll('img')].filter(img =>
    img.src && img.src.includes('/api/')
  );
  return Promise.all(imgs.map(async img => ({
    filename : img.closest('[data-testid]')?.getAttribute('data-testid') || img.alt || null,
    alt      : img.alt || null,
    url      : img.src,
    data     : await fetchBase64(img.src),
  })));
}

// ─── Supporting scrapers ──────────────────────────────────────────────────────
function detectEmail() {
  try {
    const btn = document.querySelector(SEL.emailButton);
    if (btn) {
      const label = btn.getAttribute('aria-label') || btn.innerText || '';
      const match = label.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (match) return match[0];
    }
    const el = document.getElementById('__NEXT_DATA__');
    if (el) {
      const data  = JSON.parse(el.textContent);
      const email =
        data?.props?.pageProps?.currentUser?.email ||
        data?.props?.pageProps?.user?.email        ||
        data?.props?.pageProps?.account?.email;
      if (email) return email;
    }
  } catch (_) {}
  return null;
}

function scrapeConversationId() {
  const m = window.location.pathname.match(/\/chat\/([a-zA-Z0-9\-]+)/);
  return m ? m[1] : null;
}

function scrapeTitle() {
  const el = document.querySelector(SEL.activeTitle);
  if (el?.innerText?.trim()) return el.innerText.trim();
  return document.title.replace(/\s*[-|]\s*Claude.*$/i, '').trim() || null;
}

// ─── Build messages from API data + DOM images ────────────────────────────────
async function buildMessagesFromAPI(apiMessages) {
  const domUserMsgs = [...document.querySelectorAll(SEL.humanTurn)];
  let userIdx = 0;
  const built = await Promise.all(apiMessages.map(async (msg) => {
    const role = msg.sender === 'human' ? 'user' : 'assistant';

    let textContent = msg.text || '';
    const contentParts = [];
    let hasArtifact = false;
    const artifactInfo = {};
    const citations = [];

    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const blockType = block.type || '';
        if (blockType === 'text') {
          const t = block.text || '';
          if (t) contentParts.push(t);
          if (Array.isArray(block.citations) && block.citations.length) {
            citations.push(...block.citations);
          }
        } else if (blockType === 'tool_use') {
          if (block.name === 'artifacts') {
            hasArtifact = true;
            const input = block.input || {};
            artifactInfo.title         = input.title    || '';
            artifactInfo.language      = input.language || '';
            artifactInfo.artifact_type = input.type     || '';
            const artifactContent = input.content || '';
            if (artifactContent) {
              contentParts.push(`\n\n\`\`\`${artifactInfo.language}\n${artifactContent}\n\`\`\``);
            }
          }
        }
      }
    }

    const content = contentParts.length ? contentParts.join('\n') : textContent;

    let contentType = 'text';
    const metadata = {};
    if (hasArtifact) {
      contentType = artifactInfo.artifact_type === 'application/vnd.ant.code' ? 'code' : 'artifact';
      if (artifactInfo.language) metadata.language = artifactInfo.language;
      if (artifactInfo.title)    metadata.title    = artifactInfo.title;
    } else if (content.includes('```')) {
      contentType = 'code';
      const m = content.match(/```(\w+)/);
      if (m) metadata.language = m[1];
    }
    if (citations.length) metadata.citations = citations;

    let images = [];
    if (role === 'user' && domUserMsgs[userIdx]) {
      images = await extractImages(domUserMsgs[userIdx]);
    }
    if (role === 'user') userIdx++;
    if (images.length) metadata.images = images;

    const msgObj = {
      id          : msg.uuid || null,
      role        : role,
      content     : content,
      content_type: contentType,
      timestamp   : msg.created_at || null,
      parent_id   : msg.parent_message_uuid || null,
    };
    if (Object.keys(metadata).length) msgObj.metadata = metadata;
    return msgObj;
  }));
  return built.filter(m => (m.content || '').trim().length > 0);
}

// ─── DOM-only fallback ────────────────────────────────────────────────────────
async function buildMessagesFromDOM() {
  const humanTurns     = [...document.querySelectorAll(SEL.humanTurn)];
  const assistantTurns = [...document.querySelectorAll(SEL.assistantTurn)];
  if (humanTurns.length === 0 && assistantTurns.length === 0) return [];

  const tagged = [
    ...humanTurns.map(el => ({ el, role: 'user' })),
    ...assistantTurns.map(el => ({ el, role: 'assistant' })),
  ].sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );

  const built = await Promise.all(tagged.map(async (item) => {
    const content = item.el.innerText.trim();
    const metadata = {};

    let contentType = 'text';
    if (content.includes('```')) {
      contentType = 'code';
      const m = content.match(/```(\w+)/);
      if (m) metadata.language = m[1];
    }

    let images = [];
    if (item.role === 'user') {
      images = await extractImages(item.el);
      if (images.length) metadata.images = images;
    }

    const msgObj = {
      id          : null,
      role        : item.role,
      content     : content,
      content_type: contentType,
      timestamp   : null,
      parent_id   : null,
    };
    if (Object.keys(metadata).length) msgObj.metadata = metadata;
    return msgObj;
  }));

  return built.filter(m => (m.content || '').trim().length > 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function scrapeConversation() {
  const convId = scrapeConversationId();
  if (!convId) return { error: 'Could not detect conversation ID from URL.' };

  let messages      = [];
  let apiData       = null;
  let convCreatedAt = null;
  let convUpdatedAt = null;

  try {
    const orgId = await getOrgId();
    if (!orgId) throw new Error('Could not resolve organisation ID');
    apiData = await fetchConversationAPI(orgId, convId);
    const apiMessages = apiData.chat_messages || [];
    if (apiMessages.length === 0) throw new Error('API returned no messages');
    messages      = await buildMessagesFromAPI(apiMessages);
    convCreatedAt = apiData.created_at || null;
    convUpdatedAt = apiData.updated_at || null;
  } catch (apiErr) {
    console.warn('[ConvoSaver] API unavailable, falling back to DOM:', apiErr.message);
    messages = await buildMessagesFromDOM();
    if (messages.length === 0) {
      return { error: 'No messages found. Make sure you are on a Claude conversation page.' };
    }
  }

  if (!convCreatedAt || !convUpdatedAt) {
    const stamps = messages.map(m => m.timestamp).filter(Boolean).sort();
    if (stamps.length) {
      convCreatedAt = convCreatedAt || stamps[0];
      convUpdatedAt = convUpdatedAt || stamps[stamps.length - 1];
    }
  }

  const email   = detectEmail();
  const account = email ? email.split('@')[0] : '';
  const title   = apiData?.name || scrapeTitle() || 'Untitled Conversation';

  // Schema-compliant array (matches parse_claude_export output)
  const conversations = [{
    id         : convId,
    title      : title,
    source     : 'claude',
    account    : account,
    created_at : convCreatedAt || '',
    updated_at : convUpdatedAt || '',
    messages   : messages,
  }];

  // Wrapper for the popup. `conversations` is the actual payload to send.
  // The other fields are display metadata used only by popup.js.
  return {
    conversations  : conversations,
    detected_email : email,
    title          : title,
    message_count  : messages.length,
  };
}

// ─── Listener ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req.type === 'SCRAPE_CONVERSATION') {
    scrapeConversation().then(sendResponse).catch(err =>
      sendResponse({ error: err.message })
    );
  }
  return true;
});

} // end of injection guard