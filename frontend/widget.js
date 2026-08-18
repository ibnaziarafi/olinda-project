/**
 * Olinda AI Chatbot — Standalone Embeddable Widget
 * Hobart College Virtual Advisory Assistant
 *
 * Features:
 * - Welcome suggestions only inside the welcome message
 * - No fixed suggestion component
 * - Markdown rendering
 * - Markdown table → HTML table conversion
 * - Bullet and numbered lists
 * - Bold / italic
 * - Markdown links
 * - Inline course action links
 * - Session chat history
 * - Responsive widget
 */

(function () {
  if (window.OlindaWidgetInitialized) return;
  window.OlindaWidgetInitialized = true;

  // ============================================================
  // BACKEND CONFIGURATION
  // ============================================================

  const currentScript =
    document.currentScript ||
    Array.from(document.scripts).find(
      (s) => s.src && s.src.includes("widget.js")
    );

  const BACKEND_URL =
    (currentScript && currentScript.getAttribute("data-backend")) ||
    "https://olinda-ai.onrender.com";


  // ============================================================
  // STYLES
  // ============================================================

  const styleEl = document.createElement("style");

  styleEl.textContent = `
    /* ============================================================
       WIDGET VARIABLES
       ============================================================ */

    #olinda-widget-root {
      --navy: #0B2A4A;
      --blue-700: #14508C;
      --blue-600: #1E6FD9;
      --blue-400: #5C9FEF;
      --blue-100: #E9F2FD;
      --blue-50: #F5F9FE;

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


    /* ============================================================
       FLOATING CHAT BUTTON
       ============================================================ */

    .olinda-chat-launcher {
      position: fixed;

      right: 24px;
      bottom: 24px;

      z-index: 999998;

      width: 62px;
      height: 62px;

      border-radius: 50%;

      background: linear-gradient(
        155deg,
        var(--blue-600),
        var(--navy)
      );

      color: var(--white);

      display: flex;
      align-items: center;
      justify-content: center;

      cursor: pointer;

      box-shadow: var(--shadow-soft);

      border: none;

      transition:
        transform 0.2s ease,
        opacity 0.2s ease;
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
      0%, 100% {
        transform: translateY(0);
      }

      30% {
        transform: translateY(-10px);
      }

      55% {
        transform: translateY(0);
      }

      75% {
        transform: translateY(-5px);
      }
    }


    /* ============================================================
       CHAT WINDOW
       ============================================================ */

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


    /* ============================================================
       HEADER
       ============================================================ */

    .olinda-chat-header {
      background: linear-gradient(
        155deg,
        var(--blue-700),
        var(--navy)
      );

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


    /* ============================================================
       MESSAGE AREA
       ============================================================ */

    .olinda-chat-messages {
      flex: 1;

      overflow-y: auto;

      padding: 20px !important;

      display: flex;
      flex-direction: column;

      gap: 14px !important;

      background: var(--blue-50);
    }


    /* ============================================================
       MESSAGE BUBBLES
       ============================================================ */

    .olinda-msg {
      max-width: 85% !important;

      padding: 12px 16px !important;

      margin: 0 !important;

      border-radius: 16px !important;

      font-size: 0.92rem;

      line-height: 1.5;

      word-break: break-word;
    }

    .olinda-msg.bot {
      align-self: flex-start;

      background: var(--white);

      border: 1px solid var(--line);

      color: var(--ink);

      width: 100%;

      max-width: 90% !important;
    }

    .olinda-msg.user {
      align-self: flex-end;

      background: var(--blue-600);

      color: var(--white);
    }


    /* ============================================================
       MARKDOWN CONTENT
       ============================================================ */

    .olinda-msg.bot p {
      margin: 0 0 8px 0;
    }

    .olinda-msg.bot p:last-child {
      margin-bottom: 0;
    }

    .olinda-msg.bot strong {
      font-weight: 700;
    }

    .olinda-msg.bot em {
      font-style: italic;
    }

    .olinda-msg.bot h1,
    .olinda-msg.bot h2,
    .olinda-msg.bot h3 {
      margin: 12px 0 8px;

      color: var(--navy);

      line-height: 1.3;
    }

    .olinda-msg.bot h1 {
      font-size: 1.15rem;
    }

    .olinda-msg.bot h2 {
      font-size: 1.05rem;
    }

    .olinda-msg.bot h3 {
      font-size: 0.98rem;
    }


    /* ============================================================
       MARKDOWN LISTS
       ============================================================ */

    .olinda-list,
    .olinda-ordered-list {
      margin: 8px 0;

      padding-left: 22px;
    }

    .olinda-list li,
    .olinda-ordered-list li {
      margin: 4px 0;
    }


    /* ============================================================
       MARKDOWN TABLES
       ============================================================ */

    .olinda-table-wrapper {
      width: 100%;

      overflow-x: auto;

      margin: 12px 0;

      border-radius: 10px;

      border: 1px solid var(--line);

      background: var(--white);

      -webkit-overflow-scrolling: touch;
    }

    .olinda-table {
      width: 100%;

      min-width: 420px;

      border-collapse: collapse;

      font-size: 0.82rem;

      text-align: left;
    }

    .olinda-table th {
      background: var(--navy);

      color: var(--white);

      padding: 9px 10px;

      font-weight: 600;

      font-family: var(--font-body);

      border-right: 1px solid rgba(255,255,255,0.15);
    }

    .olinda-table th:last-child {
      border-right: none;
    }

    .olinda-table td {
      padding: 9px 10px;

      border-bottom: 1px solid var(--line);

      background: var(--white);

      color: var(--ink);

      line-height: 1.45;

      vertical-align: top;
    }

    .olinda-table tr:nth-child(even) td {
      background: var(--blue-50);
    }

    .olinda-table tr:last-child td {
      border-bottom: none;
    }


    /* ============================================================
       CODE
       ============================================================ */

    .olinda-inline-code {
      background: var(--blue-100);

      color: var(--navy);

      padding: 2px 5px;

      border-radius: 4px;

      font-family: var(--font-mono);

      font-size: 0.82em;
    }

    .olinda-code-block {
      display: block;

      background: #102235;

      color: #f5f7fa;

      padding: 10px;

      border-radius: 8px;

      overflow-x: auto;

      margin: 10px 0;

      font-family: var(--font-mono);

      font-size: 0.78rem;

      line-height: 1.5;
    }


    /* ============================================================
       LINKS
       ============================================================ */

    .olinda-msg.bot a {
      color: var(--blue-600);

      font-weight: 600;

      text-decoration: underline;
    }


    /* ============================================================
       INLINE WELCOME SUGGESTIONS
       ============================================================ */

    .olinda-inline-suggestions {
      display: flex;

      flex-wrap: wrap;

      gap: 6px;

      margin-top: 14px;

      padding-top: 12px;

      border-top: 1px solid var(--line);
    }

    .olinda-chip {
      font-family: var(--font-body);

      font-size: 0.80rem;

      font-weight: 500;

      color: var(--blue-700);

      background: var(--blue-100);

      border: 1px solid var(--blue-400);

      border-radius: 999px;

      padding: 6px 11px !important;

      margin: 0 !important;

      cursor: pointer;

      transition:
        background 0.15s ease,
        color 0.15s ease,
        transform 0.15s ease;
    }

    .olinda-chip:hover {
      background: var(--blue-400);

      color: var(--white);

      transform: translateY(-1px);
    }


    /* ============================================================
       ACTION LINKS
       ============================================================ */

    .olinda-action-links {
      display: flex;

      flex-wrap: wrap;

      gap: 8px;

      margin-top: 12px;

      padding-top: 10px;

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

      padding: 6px 12px;

      text-decoration: none !important;

      transition:
        background 0.15s ease,
        color 0.15s ease;
    }

    .olinda-action-btn:hover {
      background: var(--blue-600);

      color: var(--white);
    }


    /* ============================================================
       TYPING INDICATOR
       ============================================================ */

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

    .olinda-typing-dots span:nth-child(2) {
      animation-delay: 0.15s;
    }

    .olinda-typing-dots span:nth-child(3) {
      animation-delay: 0.3s;
    }

    @keyframes olinda-typing-bounce {
      0%, 60%, 100% {
        transform: translateY(0);

        opacity: 0.5;
      }

      30% {
        transform: translateY(-4px);

        opacity: 1;
      }
    }


    /* ============================================================
       INPUT AREA
       ============================================================ */

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

    .olinda-chat-input-row button:hover {
      background: var(--blue-700);
    }


    /* ============================================================
       MOBILE
       ============================================================ */

    @media (max-width: 680px) {

      #olinda-widget-root {
        right: 12px;
        bottom: 12px;
      }

      .olinda-chat-window {
        right: 12px;
        left: 12px;

        bottom: 12px;

        width: auto;

        max-width: none;

        height: min(560px, calc(100vh - 24px));
      }

      .olinda-msg.bot {
        max-width: 96% !important;
      }

      .olinda-table {
        min-width: 380px;
      }
    }
  `;

  document.head.appendChild(styleEl);


  // ============================================================
  // SESSION ID
  // ============================================================

  let sessionId = sessionStorage.getItem("olinda_session_id");

  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sess_" + Date.now();

    sessionStorage.setItem("olinda_session_id", sessionId);
  }


  // ============================================================
  // HTML STRUCTURE
  // ============================================================

  const rootEl = document.createElement("div");

  rootEl.id = "olinda-widget-root";

  rootEl.innerHTML = `
    <button
      class="olinda-chat-launcher"
      id="olinda-launcher"
      aria-label="Open Olinda chat assistant"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.2A8 8 0 1 1 21 12Z"/>
      </svg>
    </button>

    <div
      class="olinda-chat-window hidden"
      id="olinda-window"
      role="dialog"
      aria-label="Olinda chat assistant"
    >

      <div class="olinda-chat-header">

        <div class="olinda-chat-header-info">

          <span class="olinda-chat-avatar">O</span>

          <div>
            <p class="olinda-chat-name">Olinda</p>

            <p class="olinda-chat-status">
              <span class="olinda-status-dot"></span>
              Online
            </p>
          </div>

        </div>

        <button
          class="olinda-chat-close"
          id="olinda-close"
          aria-label="Close chat"
        >
          ×
        </button>

      </div>


      <div
        class="olinda-chat-messages"
        id="olinda-messages"
      ></div>


      <div class="olinda-chat-input-row">

        <input
          type="text"
          id="olinda-input"
          placeholder="Type your question…"
          aria-label="Type your question to Olinda"
        />

        <button id="olinda-send">
          Send
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(rootEl);


  // ============================================================
  // DOM REFERENCES
  // ============================================================

  const launcher = document.getElementById("olinda-launcher");

  const chatWindow = document.getElementById("olinda-window");

  const closeBtn = document.getElementById("olinda-close");

  const messagesEl = document.getElementById("olinda-messages");

  const inputEl = document.getElementById("olinda-input");

  const sendBtn = document.getElementById("olinda-send");


  // ============================================================
  // CHAT DATA
  // ============================================================

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

  const welcomeMessage =
    "👋 Hi! I'm Olinda, Hobart College's virtual assistant.\\n\\n" +
    "I can help with:\\n" +
    "• Courses\\n" +
    "• Enrolment\\n" +
    "• TCE\\n" +
    "• ATAR\\n" +
    "• VET\\n" +
    "• Student Services\\n\\n" +
    "Choose one of the suggested questions below or type your own.";

  const offlineAnswer =
    "I'm having trouble reaching my brain right now. " +
    "Please try again shortly, or contact Hobart College Student Services directly.";


  // ============================================================
  // HTML ESCAPING
  // ============================================================

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  // ============================================================
  // MARKDOWN TABLE HELPERS
  // ============================================================

  function isMarkdownTableSeparator(line) {
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length < 2) return false;

    return cells.every((cell) =>
      /^:?-{3,}:?$/.test(cell)
    );
  }


  function splitTableCells(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }


  function isPotentialTableHeader(line) {
    if (!line.includes("|")) return false;

    const cells = splitTableCells(line);

    return cells.length >= 2 &&
      cells.some((cell) => cell.length > 0);
  }


  function renderTable(tableLines) {

    if (tableLines.length < 2) {
      return null;
    }

    const headerLine = tableLines[0];

    const separatorLine = tableLines[1];

    if (!isPotentialTableHeader(headerLine)) {
      return null;
    }

    if (!isMarkdownTableSeparator(separatorLine)) {
      return null;
    }

    const headers = splitTableCells(headerLine);

    const rows = tableLines
      .slice(2)
      .map(splitTableCells)
      .filter((row) => row.length > 0);

    let tableHtml =
      '<div class="olinda-table-wrapper">' +
      '<table class="olinda-table">' +
      '<thead><tr>';

    headers.forEach((header) => {
      tableHtml += `<th>${header}</th>`;
    });

    tableHtml += "</tr></thead>";

    if (rows.length > 0) {

      tableHtml += "<tbody>";

      rows.forEach((row) => {

        tableHtml += "<tr>";

        for (let i = 0; i < headers.length; i++) {

          const cell = row[i] || "";

          tableHtml += `<td>${cell}</td>`;
        }

        tableHtml += "</tr>";
      });

      tableHtml += "</tbody>";
    }

    tableHtml +=
      "</table>" +
      "</div>";

    return tableHtml;
  }


  // ============================================================
  // MARKDOWN PARSER
  // ============================================================

  function parseMarkdown(md) {

    if (!md) return "";

    /*
     * First escape the backend response.
     * This prevents backend text from injecting HTML.
     */
    let escaped = escapeHtml(md);

    const lines = escaped.split("\n");

    const output = [];

    let i = 0;

    while (i < lines.length) {

      const currentLine = lines[i];

      /*
       * ----------------------------------------------------------
       * TABLE DETECTION
       * ----------------------------------------------------------
       *
       * Only consider something a table if:
       *
       * Line 1:
       * | Subject | Prerequisite |
       *
       * Line 2:
       * |---------|--------------|
       *
       * This avoids treating every line containing "|" as a table.
       */

      if (
        i + 1 < lines.length &&
        isPotentialTableHeader(currentLine) &&
        isMarkdownTableSeparator(lines[i + 1])
      ) {

        const tableLines = [
          currentLine,
          lines[i + 1]
        ];

        i += 2;

        /*
         * Collect table rows until the table ends.
         */
        while (i < lines.length) {

          const row = lines[i];

          if (
            row.trim() === "" ||
            !row.includes("|")
          ) {
            break;
          }

          tableLines.push(row);

          i++;
        }

        const renderedTable = renderTable(tableLines);

        if (renderedTable) {
          output.push(renderedTable);

          continue;
        }
      }


      /*
       * ----------------------------------------------------------
       * NORMAL LINE
       * ----------------------------------------------------------
       */

      output.push(currentLine);

      i++;
    }


    /*
     * Recombine the processed lines.
     */
    let html = output.join("\n");


    // ============================================================
    // CODE BLOCKS
    // ============================================================

    html = html.replace(
      /```([\s\S]*?)```/g,
      function (_, code) {
        return `<pre class="olinda-code-block">${code.trim()}</pre>`;
      }
    );


    // ============================================================
    // INLINE CODE
    // ============================================================

    html = html.replace(
      /`([^`\n]+)`/g,
      '<code class="olinda-inline-code">$1</code>'
    );


    // ============================================================
    // HEADINGS
    // ============================================================

    html = html.replace(
      /^###\s+(.+)$/gm,
      "<h3>$1</h3>"
    );

    html = html.replace(
      /^##\s+(.+)$/gm,
      "<h2>$1</h2>"
    );

    html = html.replace(
      /^#\s+(.+)$/gm,
      "<h1>$1</h1>"
    );


    // ============================================================
    // BOLD
    // ============================================================

    html = html.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    html = html.replace(
      /__(.*?)__/g,
      "<strong>$1</strong>"
    );


    // ============================================================
    // ITALIC
    // ============================================================

    html = html.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      "<em>$1</em>"
    );

    html = html.replace(
      /(?<!_)_([^_\n]+)_(?!_)/g,
      "<em>$1</em>"
    );


    // ============================================================
    // MARKDOWN LINKS
    // ============================================================

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );


    // ============================================================
    // BULLET LISTS
    // ============================================================

    html = html.replace(
      /^(?:[-•*])\s+(.+)$/gm,
      '<li>$1</li>'
    );

    html = html.replace(
      /((?:<li>.*<\/li>\n?)+)/g,
      '<ul class="olinda-list">$1</ul>'
    );


    // ============================================================
    // NUMBERED LISTS
    // ============================================================

    html = html.replace(
      /^\d+\.\s+(.+)$/gm,
      "<li>$1</li>"
    );


    /*
     * Wrap consecutive numbered list items.
     *
     * This is intentionally simple because the chatbot responses
     * are generally short advisory responses.
     */

    html = html.replace(
      /((?:<li>.*<\/li>\n?)+)/g,
      function (match) {

        if (
          match.includes('<ul class="olinda-list">')
        ) {
          return match;
        }

        return `<ol class="olinda-ordered-list">${match}</ol>`;
      }
    );


    // ============================================================
    // LINE BREAKS
    // ============================================================

    html = html.replace(/\n\n/g, "<br><br>");

    html = html.replace(/\n/g, "<br>");


    /*
     * Remove unnecessary <br> immediately around tables.
     */
    html = html.replace(
      /<br>\s*(<div class="olinda-table-wrapper">)/g,
      "$1"
    );

    html = html.replace(
      /(<\/div>)\s*<br>/g,
      "$1"
    );


    return html;
  }


  // ============================================================
  // ADD MESSAGE
  // ============================================================

  function addMessage(
    text,
    sender,
    actionLinks = null,
    inlineSuggestions = null
  ) {

    const bubble = document.createElement("div");

    bubble.className = "olinda-msg " + sender;


    /*
     * User messages are plain text.
     */
    if (sender === "user") {

      bubble.textContent = text;

    }

    /*
     * Bot messages use Markdown parser.
     */
    else {

      bubble.innerHTML = parseMarkdown(text);
    }


    // ============================================================
    // COURSE ACTION LINKS
    // ============================================================

    if (
      sender === "bot" &&
      actionLinks &&
      actionLinks.length > 0
    ) {

      const actionsContainer =
        document.createElement("div");

      actionsContainer.className =
        "olinda-action-links";


      actionLinks.forEach((link) => {

        const btn =
          document.createElement("a");

        btn.className =
          "olinda-action-btn";

        btn.href = link.url;

        btn.target = "_blank";

        btn.rel =
          "noopener noreferrer";

        btn.textContent =
          (link.title || "View Course Details") +
          " →";

        actionsContainer.appendChild(btn);
      });


      bubble.appendChild(actionsContainer);
    }


    // ============================================================
    // WELCOME MESSAGE SUGGESTIONS
    // ============================================================

    /*
     * IMPORTANT:
     *
     * Suggestions are added INSIDE the bot message bubble.
     *
     * There is NO separate suggestions component.
     */

    if (
      sender === "bot" &&
      inlineSuggestions &&
      inlineSuggestions.length > 0
    ) {

      const suggestionsContainer =
        document.createElement("div");

      suggestionsContainer.className =
        "olinda-inline-suggestions";


      inlineSuggestions.forEach((suggestionText) => {

        const chip =
          document.createElement("button");

        chip.className =
          "olinda-chip";

        chip.type = "button";

        chip.textContent =
          suggestionText;


        chip.addEventListener(
          "click",
          () => {

            sendMessage(suggestionText);

          }
        );


        suggestionsContainer.appendChild(chip);
      });


      bubble.appendChild(
        suggestionsContainer
      );
    }


    // ============================================================
    // APPEND MESSAGE
    // ============================================================

    messagesEl.appendChild(bubble);

    messagesEl.scrollTop =
      messagesEl.scrollHeight;
  }


  // ============================================================
  // TYPING INDICATOR
  // ============================================================

  function showTyping() {

    const typing =
      document.createElement("div");

    typing.className =
      "olinda-msg typing";

    typing.id =
      "olinda-typing-indicator";


    typing.innerHTML =
      'Olinda is typing ' +
      '<span class="olinda-typing-dots">' +
      '<span></span>' +
      '<span></span>' +
      '<span></span>' +
      '</span>';


    messagesEl.appendChild(typing);

    messagesEl.scrollTop =
      messagesEl.scrollHeight;
  }


  function hideTyping() {

    const typing =
      document.getElementById(
        "olinda-typing-indicator"
      );

    if (typing) {
      typing.remove();
    }
  }


  // ============================================================
  // CHAT HISTORY
  // ============================================================

  const HISTORY_KEY =
    "olinda_chat_history";


  function getHistory() {

    try {

      const raw =
        sessionStorage.getItem(
          HISTORY_KEY
        );

      return raw
        ? JSON.parse(raw)
        : [];

    } catch (error) {

      console.error(
        "Error reading chat history:",
        error
      );

      return [];
    }
  }


  function saveHistory(history) {

    try {

      sessionStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
      );

    } catch (error) {

      console.error(
        "Error saving chat history:",
        error
      );
    }
  }


  // ============================================================
  // BACKEND REQUEST
  // ============================================================

  async function getAnswer(
    query,
    history
  ) {

    try {

      const res =
        await fetch(
          BACKEND_URL + "/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              session_id:
                sessionId,

              query:
                query,

              messages:
                history
            })
          }
        );


      if (!res.ok) {

        throw new Error(
          "Backend returned " +
          res.status
        );
      }


      const data =
        await res.json();


      return {
        reply:
          data.reply || offlineAnswer,

        action_links:
          data.action_links || null
      };

    } catch (error) {

      console.error(
        "Olinda backend error:",
        error
      );


      return {
        reply:
          offlineAnswer,

        action_links:
          null
      };
    }
  }


  // ============================================================
  // SEND MESSAGE
  // ============================================================

  async function sendMessage(text) {

    const trimmed =
      String(text || "").trim();


    if (!trimmed) {
      return;
    }


    // Add user message
    addMessage(
      trimmed,
      "user"
    );


    inputEl.value = "";


    // Get previous history
    let history =
      getHistory();


    // Add current user message
    history.push({
      role: "user",
      content: trimmed
    });


    // Keep latest 10 messages
    if (history.length > 10) {

      history =
        history.slice(-10);
    }


    // Show typing
    showTyping();


    // Ask backend
    const response =
      await getAnswer(
        trimmed,
        history
      );


    // Remove typing
    hideTyping();


    // Add assistant response
    addMessage(
      response.reply,
      "bot",
      response.action_links
    );


    // Save assistant response
    history.push({
      role: "assistant",

      content:
        response.reply,

      action_links:
        response.action_links
    });


    // Keep latest 10 messages
    if (history.length > 10) {

      history =
        history.slice(-10);
    }


    saveHistory(history);
  }


  // ============================================================
  // RESTORE SESSION HISTORY
  // ============================================================

  function restoreSessionHistory() {

    const history =
      getHistory();


    if (history.length === 0) {
      return false;
    }


    hasGreeted = true;


    messagesEl.innerHTML = "";


    history.forEach((message) => {

      addMessage(
        message.content,

        message.role === "assistant"
          ? "bot"
          : "user",

        message.action_links || null
      );

    });


    return true;
  }


  // ============================================================
  // WELCOME MESSAGE
  // ============================================================

  function greet() {

    if (hasGreeted) {
      return;
    }


    /*
     * If an existing session exists,
     * restore it instead of creating
     * another welcome message.
     */

    if (restoreSessionHistory()) {
      return;
    }


    hasGreeted = true;


    /*
     * IMPORTANT:
     *
     * Suggestions are passed directly
     * into the welcome message.
     *
     * They are NOT placed in a
     * separate fixed component.
     */

    addMessage(
      welcomeMessage,
      "bot",
      null,
      suggestions
    );
  }


  // ============================================================
  // OPEN / CLOSE CHAT
  // ============================================================

  function openChat() {

    chatWindow.classList.remove(
      "hidden"
    );

    launcher.classList.add(
      "hidden"
    );


    greet();


    inputEl.focus();
  }


  function closeChat() {

    chatWindow.classList.add(
      "hidden"
    );

    launcher.classList.remove(
      "hidden"
    );
  }


  // ============================================================
  // EVENTS
  // ============================================================

  launcher.addEventListener(
    "click",
    openChat
  );


  closeBtn.addEventListener(
    "click",
    closeChat
  );


  sendBtn.addEventListener(
    "click",
    () => {

      sendMessage(
        inputEl.value
      );

    }
  );


  inputEl.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {

        event.preventDefault();

        sendMessage(
          inputEl.value
        );
      }

    }
  );


  // ============================================================
  // LAUNCHER BOUNCE
  // ============================================================

  setInterval(() => {

    if (
      chatWindow.classList.contains(
        "hidden"
      )
    ) {

      launcher.classList.remove(
        "bounce"
      );

      void launcher.offsetWidth;

      launcher.classList.add(
        "bounce"
      );
    }

  }, 4000);


  // ============================================================
  // AUTO OPEN
  // ============================================================

  window.addEventListener(
    "load",
    () => {

      setTimeout(() => {

        if (
          chatWindow.classList.contains(
            "hidden"
          )
        ) {

          openChat();
        }

      }, 1500);

    }
  );

})();