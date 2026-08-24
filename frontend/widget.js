/**
 * Olinda AI Chatbot — Standalone Embeddable Widget
 * Hobart College Virtual Advisory Assistant
 */
(function () {
  if (window.OlindaWidgetInitialized) return;
  window.OlindaWidgetInitialized = true;

  // Determine backend URL from script tag attributes or fallback to window origin
  const currentScript = document.currentScript || Array.from(document.scripts).find(s => s.src && s.src.includes('widget.js'));
  const attrBackend = currentScript && currentScript.getAttribute('data-backend');
  const BACKEND_URL = attrBackend || (window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://olinda-ai.onrender.com');

  // Inject Custom Styles with Forced Internal Margins and Padding
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Widget Colors & Variables */
    #olinda-widget-root {
      /* Official Hobart College brand colours (Pantone 7686C navy / 7409C gold) */
      --navy: #1B4C8C;
      --blue-700: #14508C;
      --blue-600: #1E6FD9;
      --blue-400: #5C9FEF;
      --blue-100: #E9F2FD;
      --blue-50:  #F5F9FE;
      --gold: #F5A81C;
      --gold-soft: #FCE6BB;
      --white: #FFFFFF;
      --ink: #1C2B3A;
      --ink-soft: #52667A;
      --line: #D9E6F5;

      --font-display: 'Fraunces', Georgia, serif;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'IBM Plex Mono', ui-monospace, monospace;

      --radius-lg: 20px;
      --shadow-soft: 0 20px 45px -20px rgba(11,42,74,0.25);

      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: var(--font-body);
      box-sizing: border-box !important;
      -webkit-font-smoothing: antialiased;
    }

    #olinda-widget-root *, 
    #olinda-widget-root *::before, 
    #olinda-widget-root *::after {
      box-sizing: border-box !important;
    }

    /* Floating Round Chat Button */
    .olinda-chat-launcher {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999998;
      width: 62px;
      height: 62px;
      border-radius: 50%;
      background: linear-gradient(155deg, var(--blue-600), var(--navy));
      color: var(--white);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow-soft);
      border: 3px solid var(--gold);
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .olinda-chat-launcher svg {
      width: 26px;
      height: 26px;
    }

    .olinda-chat-launcher.bounce {
      animation: olinda-launcher-bounce 0.9s ease;
    }

    .olinda-chat-launcher.hidden {
      display: none !important;
    }

    @keyframes olinda-launcher-bounce {
      0%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
      55% { transform: translateY(0); }
      75% { transform: translateY(-5px); }
    }

    /* Chat Window Box */
    .olinda-chat-window {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999999;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 48px);
      background: var(--white);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-soft);
      border: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .olinda-chat-window.hidden {
      display: none !important;
    }

    /* Header */
    .olinda-chat-header {
      background: linear-gradient(155deg, var(--blue-700), var(--navy));
      color: var(--white);
      padding: 16px 20px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      border-bottom: 3px solid var(--gold);
    }

    .olinda-chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .olinda-chat-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--gold);
      color: var(--navy);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1rem;
    }

    .olinda-chat-name {
      margin: 0 !important;
      font-weight: 600;
      font-size: 0.98rem;
    }

    .olinda-chat-status {
      margin: 0 !important;
      font-size: 0.74rem;
      color: rgba(255, 255, 255, 0.75);
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
    }

    .olinda-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ADE80;
      display: inline-block;
    }

    .olinda-chat-close {
      background: rgba(255, 255, 255, 0.14);
      border: none;
      color: var(--white);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Chat Messages Body - Explicit Padding & Margin Override */
    .olinda-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px !important;
      display: flex;
      flex-direction: column;
      gap: 14px !important;
      background: var(--blue-50);
    }

    .olinda-msg {
      max-width: 85% !important;
      padding: 12px 16px !important;
      margin: 0 !important;
      border-radius: 16px !important;
      font-size: 0.92rem;
      line-height: 1.5;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .olinda-msg.bot {
      align-self: flex-start;
      background: var(--white);
      border: 1px solid var(--line);
      color: var(--ink);
      width: 100%;
      max-width: 90% !important;
    }

    /* Markdown Tables Container & Formatting */
    .olinda-table-wrapper {
      width: 100%;
      max-width: 100%;
      overflow-x: auto; /* Isolated horizontal scrolling strictly for table */
      -webkit-overflow-scrolling: touch;
      margin: 10px 0;
      border-radius: 8px;
      border: 1px solid var(--line);
    }

    .olinda-table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      text-align: left;
    }

    .olinda-table th {
      background: var(--navy);
      color: var(--white);
      padding: 8px 10px;
      font-weight: 600;
      font-family: var(--font-body);
      white-space: nowrap; /* Prevents column header text from wrapping */
    }

    .olinda-table td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: var(--white);
      color: var(--ink);
      line-height: 1.45;
      white-space: nowrap; /* Keeps rows intact so table expands horizontally */
    }

    .olinda-table tr:nth-child(even) td {
      background: var(--blue-50);
    }

    .olinda-table tr:last-child td {
      border-bottom: none;
    }

    /* Custom scrollbar for scrollable tables */
    .olinda-table-wrapper::-webkit-scrollbar {
      height: 5px;
    }

    .olinda-table-wrapper::-webkit-scrollbar-thumb {
      background: var(--blue-400);
      border-radius: 3px;
    }

    .olinda-table-wrapper::-webkit-scrollbar-track {
      background: var(--blue-50);
    }

    .olinda-list {
      margin: 8px 0;
      padding-left: 20px;
    }

    .olinda-msg.bot a {
      color: var(--blue-600);
      font-weight: 600;
      text-decoration: underline;
    }

    .olinda-msg.user {
      align-self: flex-end;
      background: var(--blue-600);
      color: var(--white);
      white-space: pre-line;
    }

    .olinda-msg.typing {
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--ink-soft);
      padding: 12px 16px !important;
    }

    .olinda-typing-dots {
      display: inline-flex;
      gap: 4px;
    }

    .olinda-typing-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--blue-400);
      animation: olinda-typing-bounce 1s infinite ease-in-out;
    }

    .olinda-typing-dots span:nth-child(2) { animation-delay: .15s; }
    .olinda-typing-dots span:nth-child(3) { animation-delay: .3s; }

    @keyframes olinda-typing-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: .5; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    /* Inline Action Links & Inline Suggestions inside message cards */
    .olinda-action-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px !important;
      margin-top: 12px !important;
      padding-top: 10px !important;
      border-top: 1px solid var(--line);
    }

    .olinda-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-body);
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--blue-700);
      background: var(--blue-100);
      border: 1px solid var(--blue-400);
      border-radius: 8px;
      padding: 6px 12px !important;
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .olinda-action-btn:hover {
      background: var(--blue-600);
      color: var(--white);
    }

    .olinda-inline-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px !important;
      margin-top: 12px !important;
      padding-top: 10px !important;
      border-top: 1px solid var(--line);
    }

    .olinda-chip {
      font-family: var(--font-body);
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--blue-700);
      background: var(--blue-100);
      border: 1px solid var(--blue-400);
      border-radius: 999px;
      padding: 6px 12px !important;
      margin: 0 !important;
      cursor: pointer;
    }

    .olinda-chip:hover {
      background: var(--gold);
      border-color: var(--gold);
      color: var(--navy);
    }

    /* Input Footer Area */
    .olinda-chat-input-row {
      display: flex;
      gap: 10px !important;
      padding: 16px 20px !important;
      border-top: 1px solid var(--line);
      background: var(--white);
      flex-shrink: 0;
    }

    .olinda-chat-input-row input {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 12px 18px !important;
      margin: 0 !important;
      font-family: var(--font-body);
      font-size: 0.92rem;
      color: var(--ink);
      background: var(--blue-50);
      outline: none;
    }

    .olinda-chat-input-row input:focus {
      border-color: var(--blue-400);
      background: var(--white);
    }

    .olinda-chat-input-row button {
      background: var(--blue-600);
      color: var(--white);
      border: none;
      border-radius: 999px;
      padding: 0 22px !important;
      margin: 0 !important;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
    }

    @media (max-width: 680px) {
      .olinda-chat-window {
        right: 12px;
        left: 12px;
        bottom: 12px;
        width: auto;
        max-width: none;
        height: min(560px, calc(100vh - 24px));
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Session ID Management
  let sessionId = sessionStorage.getItem('olinda_session_id');
  if (!sessionId) {
    sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'sess_' + Date.now();
    sessionStorage.setItem('olinda_session_id', sessionId);
  }

  // Inject Markup
  const rootEl = document.createElement('div');
  rootEl.id = 'olinda-widget-root';
  rootEl.innerHTML = `
    <button class="olinda-chat-launcher" id="olinda-launcher" aria-label="Open Olinda chat assistant">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.2A8 8 0 1 1 21 12Z"/>
      </svg>
    </button>

    <div class="olinda-chat-window hidden" id="olinda-window" role="dialog" aria-label="Olinda chat assistant">
      <div class="olinda-chat-header">
        <div class="olinda-chat-header-info">
          <span class="olinda-chat-avatar">O</span>
          <div>
            <p class="olinda-chat-name">Olinda</p>
            <p class="olinda-chat-status"><span class="olinda-status-dot"></span> Online</p>
          </div>
        </div>
        <button class="olinda-chat-close" id="olinda-close" aria-label="Close chat">×</button>
      </div>

      <div class="olinda-chat-messages" id="olinda-messages"></div>

      <div class="olinda-chat-input-row">
        <input type="text" id="olinda-input" placeholder="Type your question…" aria-label="Type your question to Olinda" />
        <button id="olinda-send">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(rootEl);

  const launcher = document.getElementById('olinda-launcher');
  const chatWindow = document.getElementById('olinda-window');
  const closeBtn = document.getElementById('olinda-close');
  const messagesEl = document.getElementById('olinda-messages');
  const inputEl = document.getElementById('olinda-input');
  const sendBtn = document.getElementById('olinda-send');

  let hasGreeted = false;

  const suggestions = [
    "How do I enrol?",
    "What is TCE?",
    "What is ATAR?",
    "What is VET?",
    "What courses are available?",
    "Reset my DECYP password",
    "Student Services",
    "UTAS pathways"
  ];

  const welcomeMessage = "👋 Hi! I'm Olinda, Hobart College's virtual assistant.\n\nI can help with:\n• Courses\n• Enrolment\n• TCE\n• ATAR\n• VET\n• Student Services\n\nChoose one of the suggested questions below or type your own.";
  const offlineAnswer = "I'm having trouble reaching my brain right now. Please try again shortly, or contact Hobart College Student Services directly.";
  const timeoutAnswer = "This is taking longer than usual — I may be waking up after a quiet period. Please try asking again in a moment.";
  const REQUEST_TIMEOUT_MS = 20000;
  let isSending = false;

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseMarkdown(md) {
    if (!md) return "";

    let html = escapeHtml(md);

    // Process Markdown Tables
    const lines = html.split("\n");
    let processed = [];
    let inTable = false;
    let tableHtml = [];

    function isTableRow(l) {
      const s = l.trim();
      return s.startsWith("|") || (s.includes("|") && s.split("|").length >= 3 && !s.startsWith("http"));
    }

    function isSeparator(l) {
      const s = l.trim();
      return /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/.test(s);
    }

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();

      if (isTableRow(rawLine)) {
        if (isSeparator(rawLine)) {
          continue;
        }

        // Extract cells
        const cells = rawLine.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
        if (!cells || cells.length === 0 || cells.every(c => c === "")) {
          continue;
        }

        if (!inTable) {
          inTable = true;
          tableHtml = ['<div class="olinda-table-wrapper"><table class="olinda-table"><thead><tr>'];
          cells.forEach(cell => { tableHtml.push(`<th>${cell}</th>`); });
          tableHtml.push('</tr></thead><tbody>');
        } else {
          tableHtml.push('<tr>');
          cells.forEach(cell => { tableHtml.push(`<td>${cell}</td>`); });
          tableHtml.push('</tr>');
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml.push('</tbody></table></div>');
          processed.push(tableHtml.join(""));
          tableHtml = [];
        }
        processed.push(lines[i]);
      }
    }

    if (inTable) {
      tableHtml.push('</tbody></table></div>');
      processed.push(tableHtml.join(""));
    }

    html = processed.join("\n");

    // Format Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Format Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Format Markdown Links ([title](url))
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Format Bullet Lists (- item, • item, or * item)
    html = html.replace(/^(?:[\-\•\*]\s+)(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul class="olinda-list">$1</ul>');

    // Convert line breaks while leaving table wrappers clean
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function addMessage(text, sender, actionLinks = null, inlineSuggestions = null) {
    const bubble = document.createElement("div");
    bubble.className = "olinda-msg " + sender;
    if (sender === "user") {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = parseMarkdown(text);
    }

    // Render course redirect buttons dynamically inline inside the assistant message card
    if (sender === "bot" && actionLinks && actionLinks.length > 0) {
      const actionsContainer = document.createElement("div");
      actionsContainer.className = "olinda-action-links";
      actionLinks.forEach(link => {
        const btn = document.createElement("a");
        btn.className = "olinda-action-btn";
        btn.href = link.url;
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
        btn.textContent = (link.title || "View Course Details") + " →";
        actionsContainer.appendChild(btn);
      });
      bubble.appendChild(actionsContainer);
    }

    // Render inline quick prompt suggestions if provided
    if (sender === "bot" && inlineSuggestions && inlineSuggestions.length > 0) {
      const sugContainer = document.createElement("div");
      sugContainer.className = "olinda-inline-suggestions";
      inlineSuggestions.forEach(text => {
        const chip = document.createElement("button");
        chip.className = "olinda-chip";
        chip.type = "button";
        chip.textContent = text;
        chip.addEventListener("click", () => sendMessage(text));
        sugContainer.appendChild(chip);
      });
      bubble.appendChild(sugContainer);
    }

    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "olinda-msg typing";
    typing.id = "olinda-typing-indicator";
    typing.innerHTML = 'Olinda is typing <span class="olinda-typing-dots"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("olinda-typing-indicator");
    if (typing) typing.remove();
  }

  // Session History Management
  const HISTORY_KEY = 'olinda_chat_history';
  const transientReplyPrefix = "I encountered a temporary problem generating an answer.";
  const isTransientReply = reply => typeof reply === "string" && (
    reply.startsWith(transientReplyPrefix) || reply === offlineAnswer
  );

  function getHistory() {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      return Array.isArray(history) ? history.filter(msg => !(
        msg && msg.role === "assistant" && isTransientReply(msg.content)
      )) : [];
    } catch (e) {
      console.error("Error reading chat history from sessionStorage", e);
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Error saving chat history to sessionStorage", e);
    }
  }

  async function getAnswer(query, history) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const payload = {
        session_id: sessionId,
        query: query,
        messages: history
      };
      console.log("[OLINDA] Sending chat payload:", payload);
      const res = await fetch(BACKEND_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error("Backend returned " + res.status);
      const data = await res.json();
      console.log("[OLINDA] Chat response:", {
        status: res.status,
        hasReply: typeof data.reply === "string" && data.reply.length > 0,
        confidence: data.confidence,
        escalated: data.escalated,
        actionLinks: data.action_links || null
      });
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("Backend response did not contain a reply");
      }
      return {
        reply: data.reply,
        action_links: data.action_links || null,
        transient: isTransientReply(data.reply)
      };
    } catch (err) {
      console.error("[OLINDA] Backend request/response error:", err);
      const timedOut = err && err.name === "AbortError";
      return { reply: timedOut ? timeoutAnswer : offlineAnswer, action_links: null, transient: true };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    isSending = true;

    try {
      // Once the user asks something, the starter suggestion chips have
      // done their job - remove them so they don't linger in the
      // scrollable history and clutter up the conversation.
      document.querySelectorAll('.olinda-inline-suggestions').forEach(el => el.remove());

      addMessage(trimmed, "user");
      inputEl.value = "";

      // 1. Read existing history from sessionStorage
      let history = getHistory();

      // 2. Append new user message
      history.push({ role: "user", content: trimmed });

      // 3. Trim window to most recent 10 messages (5 turns)
      if (history.length > 10) {
        history = history.slice(-10);
      }

      showTyping();
      // 4. Send full trimmed history array along with latest user query to backend
      const res = await getAnswer(trimmed, history);
      hideTyping();
      addMessage(res.reply, "bot", res.action_links);

      // 5. Save updated history (including assistant's reply and action_links) back to sessionStorage
      if (!res.transient) {
        history.push({ role: "assistant", content: res.reply, action_links: res.action_links });
      }
      if (history.length > 10) {
        history = history.slice(-10);
      }
      saveHistory(history);
    } finally {
      isSending = false;
    }
  }

  function restoreSessionHistory() {
    const history = getHistory();
    if (history.length > 0) {
      hasGreeted = true;
      messagesEl.innerHTML = "";
      history.forEach(msg => {
        addMessage(msg.content, msg.role === "assistant" ? "bot" : "user", msg.action_links || null);
      });
      return true;
    }
    return false;
  }

  function greet() {
    if (hasGreeted) return;
    if (restoreSessionHistory()) return;
    hasGreeted = true;
    addMessage(welcomeMessage, "bot", null, suggestions);
  }

  function openChat() {
    chatWindow.classList.remove("hidden");
    launcher.classList.add("hidden");
    greet();
    inputEl.focus();
  }

  function closeChat() {
    chatWindow.classList.add("hidden");
    launcher.classList.remove("hidden");
  }

  launcher.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);

  sendBtn.addEventListener("click", () => sendMessage(inputEl.value));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage(inputEl.value);
  });

  // Bounce animation loop
  setInterval(() => {
    if (chatWindow.classList.contains("hidden")) {
      launcher.classList.remove("bounce");
      void launcher.offsetWidth;
      launcher.classList.add("bounce");
    }
  }, 4000);

  // Auto-open 1.5s after load
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (chatWindow.classList.contains("hidden")) {
        openChat();
      }
    }, 1500);
  });
})();