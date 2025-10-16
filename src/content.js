const PROMPTY_BUTTON_ID = 'prompty-action-button';
const PROMPTY_TOAST_ID = 'prompty-toast';
let currentTarget = null;
let detachTargetListeners = null;

const debugState = {
  lastTargetRect: null,
  lastToast: null,
  activeTargetSelector: null,
};

const button = createPromptyButton();
const toast = createToastElement();

function createPromptyButton() {
  const existing = document.getElementById(PROMPTY_BUTTON_ID);
  if (existing) {
    return existing;
  }
  const btn = document.createElement('button');
  btn.id = PROMPTY_BUTTON_ID;
  btn.type = 'button';
  btn.textContent = 'Improve with Prompty';
  btn.classList.add('prompty-hidden');
  btn.setAttribute('aria-label', 'Improve this prompt with Prompty');
  btn.setAttribute('data-prompty', 'action');
  btn.addEventListener('mousedown', (event) => {
    // Prevent the focused element from losing focus while we work.
    event.preventDefault();
  });
  btn.addEventListener('click', () => {
    if (!currentTarget) {
      showToast('Prompty could not find the active editor.', 'error');
      return;
    }
    const original = getEditableContent(currentTarget);
    if (!original || !original.trim()) {
      showToast('Type a prompt first so Prompty knows what to improve.', 'info');
      return;
    }
    const improved = buildImprovedPrompt(original);
    if (improved.trim() === original.trim()) {
      showToast('This prompt already looks solid. Prompty kept it as-is.', 'info');
      return;
    }
    setEditableContent(currentTarget, improved);
    showToast('Prompt leveled up! Review the structured version and adjust if needed.', 'success');
  });
  const parent = document.body || document.documentElement;
  parent.appendChild(btn);
  return btn;
}

function createToastElement() {
  const existing = document.getElementById(PROMPTY_TOAST_ID);
  if (existing) {
    return existing;
  }
  const el = document.createElement('div');
  el.id = PROMPTY_TOAST_ID;
  el.classList.add('prompty-hidden');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('data-prompty', 'toast');
  const parent = document.body || document.documentElement;
  parent.appendChild(el);
  return el;
}

function isEditableElement(el) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = el.type ? el.type.toLowerCase() : 'text';
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'].includes(type) && !el.readOnly;
  }
  if (el.isContentEditable) return true;
  return false;
}

function getEditableContent(el) {
  if (!el) return '';
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  if (el.isContentEditable) {
    return el.innerText || '';
  }
  return '';
}

function setEditableContent(el, value) {
  if (!el) return;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerText = value;
    const inputEvent = new Event('input', { bubbles: true });
    el.dispatchEvent(inputEvent);
  }
}

function positionButtonFor(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const isHidden = rect.width === 0 && rect.height === 0;
  if (isHidden) {
    hideButton();
    return;
  }

  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const topAbove = rect.top + scrollY - button.offsetHeight - 12;
  const topBelow = rect.bottom + scrollY + 12;
  const top = topAbove < scrollY + 8 ? Math.min(topBelow, scrollY + window.innerHeight - button.offsetHeight - 16) : topAbove;
  const left = scrollX + rect.right - button.offsetWidth;

  button.style.top = `${Math.max(scrollY + 8, top)}px`;
  button.style.left = `${Math.max(scrollX + 8, left)}px`;

  debugState.lastTargetRect = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function showButton(target) {
  currentTarget = target;
  button.classList.remove('prompty-hidden');
  positionButtonFor(target);
  attachTargetListeners(target);
  debugState.activeTargetSelector = buildElementSelector(target);
}

function hideButton() {
  button.classList.add('prompty-hidden');
  currentTarget = null;
  if (typeof detachTargetListeners === 'function') {
    detachTargetListeners();
    detachTargetListeners = null;
  }
  debugState.activeTargetSelector = null;
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.remove('prompty-hidden');
  toast.classList.add('visible');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('visible');
    toast.classList.add('prompty-hidden');
  }, 3200);
  debugState.lastToast = { message, type, timestamp: Date.now() };
}

function attachTargetListeners(target) {
  if (!target) return;
  if (typeof detachTargetListeners === 'function') {
    detachTargetListeners();
  }

  const reposition = () => {
    window.requestAnimationFrame(() => {
      if (currentTarget === target) {
        positionButtonFor(target);
      }
    });
  };

  const inputListener = () => reposition();
  const scrollListener = () => reposition();

  target.addEventListener('input', inputListener, { passive: true });
  target.addEventListener('keyup', inputListener, { passive: true });
  target.addEventListener('scroll', scrollListener, { passive: true });

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(reposition);
    resizeObserver.observe(target);
  }

  detachTargetListeners = () => {
    target.removeEventListener('input', inputListener);
    target.removeEventListener('keyup', inputListener);
    target.removeEventListener('scroll', scrollListener);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  };
}

function buildElementSelector(element) {
  if (!element || !element.tagName) return null;
  const parts = [];
  let current = element;
  while (current && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const className = current.className && typeof current.className === 'string'
      ? current.className
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join('')
      : '';
    parts.unshift(`${tag}${id}${className}`);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function formatSentence(sentence) {
  if (!sentence) return '';
  let trimmed = sentence.trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/^[\-\*•]\s*/, '');
  if (!/[.!?)]$/.test(trimmed)) {
    trimmed += '.';
  }
  return trimmed;
}

function splitSentences(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sentences = [];
  for (const line of lines) {
    const cleanedLine = line.replace(/^[\-\*•]\s*/, '');
    const parts = cleanedLine
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      sentences.push(cleanedLine);
    } else {
      sentences.push(...parts);
    }
  }
  if (sentences.length === 0) {
    sentences.push(text.trim());
  }
  return sentences.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function classifySentences(sentences) {
  const categories = {
    objective: '',
    context: [],
    constraints: [],
    outputs: [],
    steps: [],
    persona: [],
    tone: [],
    other: [],
  };
  if (sentences.length > 0) {
    categories.objective = sentences[0];
  }
  const rest = sentences.slice(1);
  const constraintRegex = /(must|should|need to|require|limit|avoid|never|do not|don't|cannot|deadline|within|only|strictly)/i;
  const outputRegex = /(provide|return|output|deliver|format|list|summarize|write|generate|give me|produce|draft|create|respond with|include)/i;
  const stepRegex = /(first|then|next|after|before|step|process|workflow|sequence)/i;
  const contextRegex = /(because|so that|for (?:my|our)|i am|i'm|we are|audience|background|current|existing|using|working on|project|goal|objective|purpose|currently|situation)/i;
  const personaRegex = /(act as|pretend to be|roleplay|take on the role|you are .*|from the perspective|as an?)/i;
  const toneRegex = /(tone|style|voice|friendly|professional|casual|formal|concise|detailed|approachable|empathetic|persuasive|optimistic|neutral)/i;

  for (const sentence of rest) {
    const lowerMatch = sentence;
    if (personaRegex.test(lowerMatch)) {
      categories.persona.push(sentence);
      continue;
    }
    if (toneRegex.test(lowerMatch)) {
      categories.tone.push(sentence);
      continue;
    }
    if (constraintRegex.test(lowerMatch)) {
      categories.constraints.push(sentence);
      continue;
    }
    if (outputRegex.test(lowerMatch)) {
      categories.outputs.push(sentence);
      continue;
    }
    if (stepRegex.test(lowerMatch)) {
      categories.steps.push(sentence);
      continue;
    }
    if (contextRegex.test(lowerMatch)) {
      categories.context.push(sentence);
      continue;
    }
    categories.other.push(sentence);
  }
  return categories;
}

function buildImprovedPrompt(rawText) {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return rawText;
  }

  const sentences = splitSentences(rawText);
  const categories = classifySentences(sentences);

  const sections = ['# Prompty Enhanced Prompt'];

  if (categories.objective) {
    sections.push('## Objective');
    sections.push(formatSentence(categories.objective));
  }

  if (categories.persona.length > 0) {
    sections.push('## Role or Persona');
    sections.push(...categories.persona.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.context.length > 0) {
    sections.push('## Context');
    sections.push(...categories.context.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.other.length > 0) {
    sections.push('## Key Details');
    sections.push(...categories.other.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.steps.length > 0) {
    sections.push('## Process Guidance');
    sections.push(...categories.steps.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.constraints.length > 0) {
    sections.push('## Constraints');
    sections.push(...categories.constraints.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.outputs.length > 0) {
    sections.push('## Output Expectations');
    sections.push(...categories.outputs.map((item) => `- ${formatSentence(item)}`));
  }

  if (categories.tone.length > 0) {
    sections.push('## Tone & Style');
    sections.push(...categories.tone.map((item) => `- ${formatSentence(item)}`));
  }

  const checklist = [];
  checklist.push('Verify any assumptions and ask clarifying questions if requirements seem ambiguous.');
  if (categories.outputs.length === 0) {
    checklist.push('Recommend an output format that best suits the objective.');
  }
  if (categories.constraints.length === 0) {
    checklist.push('Surface any critical constraints (timeline, tone, length) that could affect the answer.');
  }
  if (categories.persona.length === 0) {
    checklist.push('Confirm whether a specific role, persona, or audience perspective is required.');
  }
  checklist.push('Provide a concise summary of how the response addresses the objective.');

  sections.push('## Response Checklist');
  sections.push(...checklist.map((item) => `- ${formatSentence(item)}`));

  const originalBlock = rawText
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

  sections.push('---');
  sections.push('### Original Prompt');
  sections.push(originalBlock);

  return sections.join('\n\n');
}

document.addEventListener(
  'focusin',
  (event) => {
    const target = event.target;
    if (!isEditableElement(target)) {
      return;
    }
    showButton(target);
  },
  true
);

document.addEventListener(
  'focusout',
  (event) => {
    if (!currentTarget) return;
    const related = event.relatedTarget;
    if (related === button) {
      return;
    }
    window.setTimeout(() => {
      if (!document.activeElement || !isEditableElement(document.activeElement)) {
        hideButton();
      }
    }, 0);
  },
  true
);

window.addEventListener(
  'scroll',
  () => {
    if (currentTarget) {
      positionButtonFor(currentTarget);
    }
  },
  true
);

window.addEventListener('resize', () => {
  if (currentTarget) {
    positionButtonFor(currentTarget);
  }
});

// Export helpers for testing if needed.
if (typeof window !== 'undefined') {
  window.__prompty = {
    buildImprovedPrompt,
    splitSentences,
    classifySentences,
  };
  window.__promptyDebug = debugState;
}
