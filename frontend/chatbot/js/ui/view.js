import { parseMarkdown } from '../core/markdown.js';
import { createChatScroll } from './scroll.js';

const logoUrl = new URL('../../assets/hoco-mark-white.png', import.meta.url).href;
const brandMark = `<img class="brand-mark" src="${logoUrl}" alt="">`;

export function createView(shadow, config) {
  const root = document.createElement('div');
  root.className = 'widget';
  root.innerHTML = `
    <button class="launcher" type="button" aria-expanded="false" aria-controls="chat">${brandMark}<span>Ask <span data-name></span></span><span class="spark">\u2726</span></button>
    <section id="chat" class="panel" role="dialog" aria-label="College chat assistant" hidden>
      <header><div class="avatar">${brandMark}</div><div class="identity"><strong data-name></strong><span class="status" role="status">Connecting\u2026</span></div>
        <button class="icon reset" type="button" aria-label="Reset conversation" title="Start a new conversation">\u21bb</button>
        <button class="icon close" type="button" aria-label="Close chat" title="Close chat">\u00d7</button>
      </header>
      <div class="college-label"><span class="dot"></span><span data-college></span><span class="ai-label">AI ASSISTANT</span></div>
      <div class="messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions"></div>
      <button class="new-answer" type="button" hidden>New answer</button>
      <form class="composer"><label class="sr-only" for="question">Your question</label><input id="question" maxlength="4000" autocomplete="off" placeholder="Ask about your next step\u2026"><button type="submit" class="send" aria-label="Send message">\u2191</button></form>
      <footer>AI can make mistakes. Confirm important details with your college.</footer>
    </section>`;
  root.querySelectorAll('[data-name]').forEach(el => { el.textContent = config.name; });
  root.querySelector('[data-college]').textContent = config.college;
  root.querySelector('.launcher').setAttribute('aria-label', `Open ${config.name} chat assistant`);
  shadow.append(root);
  const find = selector => root.querySelector(selector);
  const scrolling = createChatScroll(find('.messages'), find('.new-answer'));
  let initialPosition = true;
  return {
    root, find,
    open(show) {
      find('.panel').hidden = !show;
      find('.launcher').hidden = show;
      find('.launcher').setAttribute('aria-expanded', String(show));
      if (show && initialPosition) {
        const answers = root.querySelectorAll('.message.assistant');
        if (answers.length) scrolling.reveal(answers[answers.length - 1]);
        initialPosition = false;
      }
      (show ? find('input') : find('.launcher')).focus({ preventScroll: true });
    },
    resetScroll() { scrolling.reset(); initialPosition = true; },
    message(message, onVote, { restoring = false } = {}) {
      const article = document.createElement('article');
      article.className = `message ${message.role}`;
      article.tabIndex = -1;
      const content = document.createElement('div');
      content.className = 'content';
      if (message.role === 'user') content.textContent = message.content;
      else content.innerHTML = parseMarkdown(message.content);
      article.append(content);
      for (const link of message.action_links || []) {
        try {
          const url = new URL(link.url);
          if (!['https:', 'http:'].includes(url.protocol)) continue;
          const anchor = document.createElement('a');
          anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
          anchor.className = 'source'; anchor.textContent = `${link.title || 'View source'} \u2197`;
          article.append(anchor);
        } catch { /* ignore malformed source links */ }
      }
      if (message.role === 'assistant' && message.message_id) {
        const votes = document.createElement('div'); votes.className = 'feedback';
        const label = document.createElement('span'); label.textContent = 'Was this helpful?'; votes.append(label);
        for (const [rating, text] of [['like', 'Yes'], ['dislike', 'No']]) {
          const button = document.createElement('button'); button.type = 'button';
          button.textContent = text; button.setAttribute('aria-label', `${rating === 'like' ? 'Like' : 'Dislike'} this answer`);
          button.setAttribute('aria-pressed', String(message.rating === rating));
          button.addEventListener('click', async () => {
            const buttons = votes.querySelectorAll('button');
            buttons.forEach(b => { b.disabled = true; });
            try {
              await onVote(message, rating);
              buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
              label.textContent = 'Thanks for your feedback';
            } catch { label.textContent = 'Could not save. Try again.'; }
            finally { buttons.forEach(b => { b.disabled = false; }); }
          });
          votes.append(button);
        }
        label.setAttribute('role', 'status');
        article.append(votes);
      }
      find('.messages').append(article);
      if (!restoring) {
        initialPosition = false;
        if (message.role === 'user') scrolling.bottom();
        else scrolling.answer(article);
      }
      return article;
    },
    welcome(onSelect) {
      const welcome = document.createElement('div'); welcome.className = 'welcome';
      const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'YOUR NEXT CHAPTER';
      const title = document.createElement('h2'); title.textContent = 'Big questions. A little guidance.';
      const description = document.createElement('p'); description.textContent = `Hi, I\u2019m ${config.name}. Let\u2019s explore courses, enrolment and life at ${config.college}.`;
      const prompts = document.createElement('div'); prompts.className = 'suggestions';
      for (const text of ['Explore courses', 'How do I enrol?', 'What is ATAR?', 'Student Services']) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `${text} \u2197`;
        button.addEventListener('click', () => onSelect(text)); prompts.append(button);
      }
      welcome.append(eyebrow, title, description, prompts); find('.messages').append(welcome);
    },
    busy(value) {
      find('.send').disabled = value;
      find('.messages').setAttribute('aria-busy', String(value));
      scrolling.removeTyping(find('.typing'));
      if (value) {
        const el = document.createElement('p'); el.className = 'typing';
        el.textContent = `${config.name} is thinking\u2026`; el.setAttribute('role', 'status');
        find('.messages').append(el); scrolling.bottom(); scrolling.begin();
      }
    },
  };
}
