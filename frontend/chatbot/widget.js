/**
 * Olinda AI Chatbot — Standalone Embeddable Widget
 * Hobart College Virtual Advisory Assistant
 */
(function () {
  if (window.OlindaWidgetInitialized) return;
  window.OlindaWidgetInitialized = true;

  // Prefer an explicit backend, then use the local service for local pages and Render in production.
  const currentScript = document.currentScript || Array.from(document.scripts).find(s => s.src && s.src.includes('widget.js'));
  const attrBackend = currentScript && currentScript.getAttribute('data-backend');
  const isLocal = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const BACKEND_URL = attrBackend || (isLocal ? 'http://localhost:8000' : 'https://olinda-ai-backend-chatbot.onrender.com');

  // Inject Custom Styles with Forced Internal Margins and Padding
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Widget Colors & Variables */
    #olinda-widget-root {
      /* Official Hobart College brand colours (Pantone 7686 C navy / 7409 C gold) */
      --navy: #1D4F91;
      --blue-700: #14508C;
      --blue-600: #1E6FD9;
      --blue-400: #5C9FEF;
      --blue-100: #E9F2FD;
      --blue-50:  #F5F9FE;
      --gold: #F0B323;
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

    /* Floating Chat Bubble Button */
    .olinda-trigger-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--navy), var(--blue-700));
      border: 2px solid var(--gold);
      box-shadow: 0 8px 24px rgba(29, 79, 145, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
      outline: none;
      padding: 0;
      margin: 0;
    }

    .olinda-trigger-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 30px rgba(29, 79, 145, 0.45);
    }

    .olinda-trigger-btn svg {
      width: 30px;
      height: 30px;
      fill: none;
      stroke: #FFFFFF;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Badge Notification */
    .olinda-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: var(--gold);
      color: var(--navy);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 7px;
      border-radius: 12px;
      border: 2px solid #FFFFFF;
    }

    /* Chat Window Container */
    .olinda-chat-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 120px);
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      box-shadow: 0 20px 50px rgba(15, 30, 60, 0.25);
      border: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .olinda-chat-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .olinda-header {
      background: linear-gradient(135deg, var(--navy), var(--blue-700));
      color: #FFFFFF;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid var(--gold);
    }

    .olinda-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .olinda-avatar {
      width: 38px;
      height: 38px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid var(--gold);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 18px;
      color: var(--gold);
    }

    .olinda-title-area h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      font-family: var(--font-display);
      letter-spacing: 0.3px;
    }

    .olinda-title-area p {
      margin: 2px 0 0 0;
      font-size: 11px;
      opacity: 0.85;
      font-family: var(--font-body);
    }

    .olinda-close-btn {
      background: transparent;
      border: none;
      color: #FFFFFF;
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      opacity: 0.8;
      transition: opacity 0.2s, background 0.2s;
    }

    .olinda-close-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }

    /* Messages Container */
    .olinda-messages {
      flex: 1;
      padding: 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--blue-50);
    }

    .olinda-msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      animation: olindaFadeIn 0.2s ease;
    }

    @keyframes olindaFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .olinda-msg-bot {
      align-self: flex-start;
      background: #FFFFFF;
      color: var(--ink);
      border: 1px solid var(--line);
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }

    .olinda-msg-user {
      align-self: flex-end;
      background: var(--navy);
      color: #FFFFFF;
      border-bottom-right-radius: 4px;
    }

    /* Action Links Container */
    .olinda-action-links {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .olinda-action-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--blue-100);
      color: var(--navy);
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      transition: background 0.2s;
      border: 1px solid var(--blue-400);
    }

    .olinda-action-link:hover {
      background: var(--gold-soft);
      color: var(--ink);
    }

    /* Input Footer */
    .olinda-footer {
      padding: 12px 14px;
      background: #FFFFFF;
      border-top: 1px solid var(--line);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .olinda-input {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      font-family: var(--font-body);
      transition: border-color 0.2s;
    }

    .olinda-input:focus {
      border-color: var(--navy);
    }

    .olinda-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--navy);
      border: none;
      color: #FFFFFF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
    }

    .olinda-send-btn:hover {
      background: var(--blue-700);
    }

    .olinda-send-btn:active {
      transform: scale(0.95);
    }

    /* Quick Suggestion Pills */
    .olinda-suggestions {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 18px;
      background: #FFFFFF;
      border-top: 1px solid var(--line);
      scrollbar-width: none;
    }

    .olinda-suggestions::-webkit-scrollbar {
      display: none;
    }

    .olinda-pill {
      white-space: nowrap;
      background: var(--blue-50);
      color: var(--navy);
      border: 1px solid var(--blue-400);
      border-radius: 14px;
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .olinda-pill:hover {
      background: var(--navy);
      color: #FFFFFF;
    }

    /* Typing Indicator */
    .olinda-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: #FFFFFF;
      border: 1px solid var(--line);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      width: fit-content;
    }

    .olinda-typing dot {
      width: 6px;
      height: 6px;
      background: var(--ink-soft);
      border-radius: 50%;
      animation: olindaBounce 1.4s infinite ease-in-out both;
    }

    .olinda-typing dot:nth-child(1) { animation-delay: -0.32s; }
    .olinda-typing dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes olindaBounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(styleEl);

  // Widget State
  let isOpen = false;
  let history = [];
  let sessionId = "session_" + Math.random().toString(36).substring(2, 9);
  const REQUEST_TIMEOUT_MS = 25000;
  const SUMMARY_KEY = "olinda_summary_" + sessionId;

  // Create DOM Elements
  const root = document.createElement("div");
  root.id = "olinda-widget-root";

  root.innerHTML = `
    <button class="olinda-trigger-btn" aria-label="Open Hobart College Advisory Assistant">
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="olinda-badge" style="display:none;">1</span>
    </button>

    <div class="olinda-chat-window">
      <div class="olinda-header">
        <div class="olinda-header-info">
          <div class="olinda-avatar">O</div>
          <div class="olinda-title-area">
            <h4>Olinda Assistant</h4>
            <p>Hobart College Course Advisory</p>
          </div>
        </div>
        <button class="olinda-close-btn" aria-label="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="olinda-messages" id="olinda-msg-container">
        <div class="olinda-msg olinda-msg-bot">
          👋 Hi! I'm Olinda, your Hobart College advisory assistant. Ask me anything about TASC courses, VET pathways, or enrollment for Year 11 & 12!
        </div>
      </div>

      <div class="olinda-suggestions">
        <div class="olinda-pill" data-query="What TASC Level 3 subjects are offered?">TASC Level 3</div>
        <div class="olinda-pill" data-query="Tell me about VET Construction courses">VET Construction</div>
        <div class="olinda-pill" data-query="How do I contact Student Services?">Student Services</div>
        <div class="olinda-pill" data-query="What are the TCE requirements?">TCE Requirements</div>
      </div>

      <div class="olinda-footer">
        <input type="text" class="olinda-input" placeholder="Type a question..." aria-label="Chat input">
        <button class="olinda-send-btn" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // References
  const triggerBtn = root.querySelector(".olinda-trigger-btn");
  const closeBtn = root.querySelector(".olinda-close-btn");
  const chatWindow = root.querySelector(".olinda-chat-window");
  const msgContainer = root.querySelector("#olinda-msg-container");
  const inputEl = root.querySelector(".olinda-input");
  const sendBtn = root.querySelector(".olinda-send-btn");
  const suggestions = root.querySelectorAll(".olinda-pill");

  // Toggle Window
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add("open");
      inputEl.focus();
    } else {
      chatWindow.classList.remove("open");
    }
  }

  triggerBtn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  // Append Messages
  function appendMessage(text, role, actionLinks = null) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `olinda-msg olinda-msg-${role}`;
    msgDiv.textContent = text;

    if (actionLinks && actionLinks.length > 0) {
      const linksContainer = document.createElement("div");
      linksContainer.className = "olinda-action-links";
      actionLinks.forEach(link => {
        const a = document.createElement("a");
        a.className = "olinda-action-link";
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.innerHTML = `🔗 ${link.title}`;
        linksContainer.appendChild(a);
      });
      msgDiv.appendChild(linksContainer);
    }

    msgContainer.appendChild(msgDiv);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.id = "olinda-typing-indicator";
    typing.className = "olinda-typing";
    typing.innerHTML = `<dot></dot><dot></dot><dot></dot>`;
    msgContainer.appendChild(typing);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function hideTyping() {
    const typing = document.querySelector("#olinda-typing-indicator");
    if (typing) typing.remove();
  }

  function saveSummary(summary) {
    if (summary && summary.trim()) {
      sessionStorage.setItem(SUMMARY_KEY, summary.trim());
    }
  }

  function getSummary() {
    return sessionStorage.getItem(SUMMARY_KEY) || "";
  }

  async function getAnswer(query, history) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const payload = {
        session_id: sessionId,
        query: query,
        messages: history,
        conversation_summary: getSummary()
      };
      console.log("[OLINDA] Sending chat payload to chatbot server:", payload);
      const res = await fetch(BACKEND_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) throw new Error("Backend returned " + res.status);
      const data = await res.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("Backend response did not contain a reply");
      }
      if (data.conversation_summary) {
        saveSummary(data.conversation_summary);
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Handle Send
  async function handleSend(textToSend) {
    const query = textToSend || inputEl.value.trim();
    if (!query) return;

    inputEl.value = "";
    appendMessage(query, "user");
    history.push({ role: "user", content: query });

    showTyping();

    try {
      const data = await getAnswer(query, history);
      hideTyping();
      appendMessage(data.reply, "bot", data.action_links);
      history.push({ role: "assistant", content: data.reply });
    } catch (err) {
      hideTyping();
      const errorMsg = err && err.name === "AbortError"
        ? "Request timed out while waiting for a response. Please check backend server."
        : "Sorry, I am having trouble connecting to the Hobart College advisory service right now. Please try again shortly.";
      appendMessage(errorMsg, "bot");
    }
  }

  sendBtn.addEventListener("click", () => handleSend());
  inputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

  suggestions.forEach(pill => {
    pill.addEventListener("click", () => {
      const query = pill.getAttribute("data-query");
      handleSend(query);
    });
  });

})();
