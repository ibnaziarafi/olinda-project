/**
 * Olinda AI Chatbot — Standalone Embeddable Widget
 * Hobart College Virtual Advisory Assistant
 */
(function () {
  if (window.OlindaWidgetInitialized) return;
  window.OlindaWidgetInitialized = true;

  // Determine backend URL from current script tag attributes or fallback to location origin
  const currentScript = document.currentScript || Array.from(document.scripts).find(s => s.src && s.src.includes('widget.js'));
  const BACKEND_URL = (currentScript && currentScript.getAttribute('data-backend')) || 'https://olinda-ai.onrender.com';

  // Inject Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Olinda Floating Widget Scoped Styles */
    #olinda-widget-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    #olinda-widget-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Floating Launcher Avatar Button */
    .olinda-launcher-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #14508C 0%, #0B2A4A 100%);
      color: #FFFFFF;
      border: none;
      box-shadow: 0 10px 25px -5px rgba(11, 42, 74, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
    }

    .olinda-launcher-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 14px 30px -4px rgba(11, 42, 74, 0.5);
    }

    .olinda-launcher-btn .olinda-avatar-icon {
      font-family: Georgia, serif;
      font-size: 1.4rem;
      font-weight: 700;
    }

    .olinda-launcher-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      background: #2FAE73;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
    }

    /* Tooltip Bubble */
    .olinda-tooltip-banner {
      position: absolute;
      right: 72px;
      bottom: 12px;
      background: #FFFFFF;
      color: #1C2B3A;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 8px 24px -6px rgba(11, 42, 74, 0.2);
      border: 1px solid #D9E6F5;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: olindaSlideIn 0.3s ease-out;
    }

    .olinda-tooltip-close {
      background: none;
      border: none;
      color: #52667A;
      font-size: 1rem;
      cursor: pointer;
      margin-left: 4px;
    }

    /* Drawer Window */
    .olinda-chat-window {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 540px;
      max-height: calc(100vh - 110px);
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 20px 45px -15px rgba(11, 42, 74, 0.3);
      border: 1px solid #D9E6F5;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: bottom right;
    }

    .olinda-chat-window.olinda-hidden {
      display: none;
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }

    /* Chat Header */
    .olinda-chat-header {
      background: linear-gradient(135deg, #0B2A4A 0%, #14508C 100%);
      color: #FFFFFF;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .olinda-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .olinda-header-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, serif;
      font-weight: 700;
      font-size: 1.1rem;
    }

    .olinda-header-title {
      font-size: 1rem;
      font-weight: 600;
    }

    .olinda-header-sub {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .olinda-status-dot {
      width: 7px;
      height: 7px;
      background: #2FAE73;
      border-radius: 50%;
      display: inline-block;
    }

    .olinda-close-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #FFFFFF;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .olinda-close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Message Body */
    .olinda-chat-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #F5F9FE;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .olinda-msg {
      max-width: 82%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 0.9rem;
      line-height: 1.45;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .olinda-msg.bot {
      align-self: flex-start;
      background: #FFFFFF;
      color: #1C2B3A;
      border: 1px solid #D9E6F5;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 8px rgba(11, 42, 74, 0.05);
    }

    .olinda-msg.user {
      align-self: flex-end;
      background: #14508C;
      color: #FFFFFF;
      border-bottom-right-radius: 4px;
    }

    /* Typing Dots */
    .olinda-typing {
      align-self: flex-start;
      background: #FFFFFF;
      border: 1px solid #D9E6F5;
      padding: 10px 14px;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      font-size: 0.8rem;
      color: #52667A;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .olinda-typing-dots span {
      width: 6px;
      height: 6px;
      background: #5C9FEF;
      border-radius: 50%;
      display: inline-block;
      animation: olindaBlink 1.4s infinite ease-in-out both;
    }
    .olinda-typing-dots span:nth-child(1) { animation-delay: 0s; }
    .olinda-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .olinda-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes olindaBlink {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }

    /* Suggestions Row */
    .olinda-suggestions-row {
      padding: 8px 16px;
      background: #F5F9FE;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      white-space: nowrap;
      border-top: 1px solid #E9F2FD;
    }

    .olinda-chip {
      background: #FFFFFF;
      border: 1px solid #5C9FEF;
      color: #14508C;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .olinda-chip:hover {
      background: #14508C;
      color: #FFFFFF;
    }

    /* Input Footer */
    .olinda-chat-footer {
      padding: 12px 16px;
      background: #FFFFFF;
      border-top: 1px solid #D9E6F5;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .olinda-chat-input {
      flex: 1;
      border: 1px solid #D9E6F5;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 0.9rem;
      outline: none;
      transition: border 0.2s;
    }

    .olinda-chat-input:focus {
      border-color: #14508C;
    }

    .olinda-send-btn {
      background: #14508C;
      color: #FFFFFF;
      border: none;
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .olinda-send-btn:hover {
      background: #0B2A4A;
    }

    @keyframes olindaSlideIn {
      from { opacity: 0; transform: translateX(10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(styleEl);

  // Session ID per tab
  let sessionId = sessionStorage.getItem('olinda_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem('olinda_session_id', sessionId);
  }

  // Inject Widget DOM Structure
  const rootEl = document.createElement('div');
  rootEl.id = 'olinda-widget-root';
  rootEl.innerHTML = `
    <div class="olinda-tooltip-banner" id="olinda-tooltip">
      👋 Need course advice? Ask Olinda!
      <button class="olinda-tooltip-close" id="olinda-tooltip-close">×</button>
    </div>

    <button class="olinda-launcher-btn" id="olinda-launcher" aria-label="Open Hobart College Chatbot">
      <span class="olinda-avatar-icon">O</span>
      <span class="olinda-launcher-badge"></span>
    </button>

    <div class="olinda-chat-window olinda-hidden" id="olinda-window">
      <div class="olinda-chat-header">
        <div class="olinda-header-info">
          <div class="olinda-header-avatar">O</div>
          <div>
            <div class="olinda-header-title">Olinda Assistant</div>
            <div class="olinda-header-sub"><span class="olinda-status-dot"></span> Hobart College Official</div>
          </div>
        </div>
        <button class="olinda-close-btn" id="olinda-close">×</button>
      </div>

      <div class="olinda-chat-body" id="olinda-messages"></div>
      <div class="olinda-suggestions-row" id="olinda-suggestions"></div>

      <div class="olinda-chat-footer">
        <input type="text" class="olinda-chat-input" id="olinda-input" placeholder="Type your course question..." />
        <button class="olinda-send-btn" id="olinda-send">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(rootEl);

  // References
  const launcherBtn = document.getElementById('olinda-launcher');
  const chatWindow = document.getElementById('olinda-window');
  const closeBtn = document.getElementById('olinda-close');
  const messagesEl = document.getElementById('olinda-messages');
  const suggestionsEl = document.getElementById('olinda-suggestions');
  const inputEl = document.getElementById('olinda-input');
  const sendBtn = document.getElementById('olinda-send');
  const tooltipEl = document.getElementById('olinda-tooltip');
  const tooltipCloseBtn = document.getElementById('olinda-tooltip-close');

  let greeted = false;

  const suggestions = [
    "What is TCE?",
    "What is ATAR?",
    "How do I enrol?",
    "What is VET?",
    "Contact Student Services"
  ];

  function addMessage(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `olinda-msg ${sender}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'olinda-typing';
    typing.id = 'olinda-typing-indicator';
    typing.innerHTML = `Olinda is thinking <div class="olinda-typing-dots"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('olinda-typing-indicator');
    if (typing) typing.remove();
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    suggestions.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'olinda-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => sendMessage(text));
      suggestionsEl.appendChild(chip);
    });
  }

  async function getAnswer(text) {
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text })
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.reply;
    } catch (err) {
      console.error('Olinda Widget Connection Error:', err);
      return "I'm having trouble connecting right now. Please reach Hobart College Student Services directly at hobart.college@decyp.tas.gov.au or (03) 6220 3133.";
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    addMessage(trimmed, 'user');
    inputEl.value = '';

    showTyping();
    const reply = await getAnswer(trimmed);
    hideTyping();
    addMessage(reply, 'bot');
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    addMessage("👋 Hi! I'm Olinda, Hobart College's virtual course assistant.\n\nAsk me anything about TASC courses, TCE, ATAR, prerequisites, or campus support!", "bot");
    renderSuggestions();
  }

  function openChat() {
    chatWindow.classList.remove('olinda-hidden');
    tooltipEl.style.display = 'none';
    greet();
    inputEl.focus();
  }

  function closeChat() {
    chatWindow.classList.add('olinda-hidden');
  }

  launcherBtn.addEventListener('click', () => {
    if (chatWindow.classList.contains('olinda-hidden')) {
      openChat();
    } else {
      closeChat();
    }
  });

  closeBtn.addEventListener('click', closeChat);
  tooltipCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tooltipEl.style.display = 'none';
  });

  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(inputEl.value);
  });
})();
