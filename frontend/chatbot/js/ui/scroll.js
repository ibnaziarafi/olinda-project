/** Scroll only the message pane and respect a reader moving through older messages. */
export function createChatScroll(messages, newAnswerButton) {
  let pending = false;
  let readingOlder = false;
  let lastPosition = messages.scrollTop;
  let unread = null;
  const atBottom = () => messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 24;
  const setPosition = top => { messages.scrollTop = Math.max(0, top); lastPosition = messages.scrollTop; };
  function track() {
    if (pending && messages.scrollTop < lastPosition - 2 && !atBottom()) readingOlder = true;
    if (pending && atBottom()) readingOlder = false;
    lastPosition = messages.scrollTop;
  }
  function reveal(article) {
    if (!article) return;
    const padding = Number.parseFloat(getComputedStyle(messages).paddingTop) || 0;
    setPosition(messages.scrollTop + article.getBoundingClientRect().top - messages.getBoundingClientRect().top - padding);
    unread = null; newAnswerButton.hidden = true;
  }
  messages.addEventListener('scroll', track, { passive: true });
  newAnswerButton.addEventListener('click', () => {
    const target = unread;
    reveal(target);
    target?.focus({ preventScroll: true });
  });
  return {
    reveal,
    bottom() { setPosition(messages.scrollHeight); },
    begin() { pending = true; readingOlder = false; lastPosition = messages.scrollTop; unread = null; newAnswerButton.hidden = true; },
    removeTyping(element) {
      track();
      const before = messages.scrollTop;
      element?.remove();
      setPosition(before);
    },
    answer(article) {
      // Typing was removed before the answer was added; preserve the reading choice.
      pending = false;
      if (readingOlder) { unread = article; newAnswerButton.hidden = false; }
      else reveal(article);
    },
    reset() { pending = false; readingOlder = false; unread = null; newAnswerButton.hidden = true; setPosition(0); },
  };
}
