/**
 * Olinda AI Chatbot — Standalone Embeddable Widget
 * Hobart College Virtual Advisory Assistant
 */
(function () {
  if (window.OlindaWidgetInitialized) return;
  window.OlindaWidgetInitialized = true;

  // Determine backend URL from script tag attributes or fallback
  const currentScript = document.currentScript || Array.from(document.scripts).find(s => s.src && s.src.includes('widget.js'));
  const BACKEND_URL = (currentScript && currentScript.getAttribute('data-backend')) || 'https://olinda-ai.onrender.com';

  // Inject Custom Styles with Forced Internal Margins and Padding
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Widget Colors & Variables */
    #olinda-widget-root {
      --navy: #0B2A4A;
      --blue-700: #14508C;
      --blue-600: #1E6FD9;
      --blue-400: #5C9FEF;
      --blue-100: #E9F2FD;
      --blue-50:  #F5F9FE;
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
      border: none;
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
      background: rgba(255, 255, 255, 0.16);
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
      white-space: pre-line;
      word-break: break-word;
    }

    .olinda-msg.bot {
      align-self: flex-start;
      background: var(--white);
      border: 1px solid var(--line);
      color: var(--ink);
    }

    .olinda-msg.user {
      align-self: flex-end;
      background: var(--blue-600);
      color: var(--white);
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
      background: var(--blue-400);
      color: var(--white);
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
          <span class="olinda-chat-avatar">E</span>
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

  function addMessage(text, sender, actionLinks = null, inlineSuggestions = null) {
    const bubble = document.createElement("div");
    bubble.className = "olinda-msg " + sender;
    bubble.textContent = text;

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

  function getHistory() {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
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
    try {
      const res = await fetch(BACKEND_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          query: query,
          messages: history
        })
      });
      if (!res.ok) throw new Error("Backend returned " + res.status);
      const data = await res.json();
      return { reply: data.reply, action_links: data.action_links || null };
    } catch (err) {
      console.error("Olinda backend error:", err);
      return { reply: offlineAnswer, action_links: null };
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

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
    history.push({ role: "assistant", content: res.reply, action_links: res.action_links });
    if (history.length > 10) {
      history = history.slice(-10);
    }
    saveHistory(history);
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