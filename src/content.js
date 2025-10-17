const PROMPTY_BUTTON_ID = 'prompty-action-button';
const PROMPTY_TOAST_ID = 'prompty-toast';
let currentTarget = null;

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
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const top = scrollY + rect.top - button.offsetHeight - 8;
  const left = scrollX + rect.right - button.offsetWidth;
  button.style.top = `${Math.max(scrollY + 8, top)}px`;
  button.style.left = `${Math.max(8 + scrollX, left)}px`;
}

function showButton(target) {
  currentTarget = target;
  button.classList.remove('prompty-hidden');
  positionButtonFor(target);
}

function hideButton() {
  button.classList.add('prompty-hidden');
  currentTarget = null;
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
    other: [],
  };
  if (sentences.length > 0) {
    categories.objective = sentences[0];
  }
  const rest = sentences.slice(1);
  const constraintRegex = /(must|should|need to|require|limit|avoid|never|do not|don't|cannot|deadline|within)/i;
  const outputRegex = /(provide|return|output|deliver|format|list|summarize|write|generate|give me|produce|draft)/i;
  const stepRegex = /(first|then|next|after|before|step|process)/i;
  const contextRegex = /(because|so that|for (?:my|our)|i am|i'm|we are|audience|background|current|existing|using|working on|project|goal|objective|purpose)/i;

  for (const sentence of rest) {
    const lowerMatch = sentence;
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

function inferExpertRole(text) {
  const lower = text.toLowerCase();
  if (/\b(website|landing page|homepage|ui|ux|hero copy)\b/.test(lower)) {
    return 'web designer and conversion-focused copywriter';
  }
  if (/\b(email|newsletter|subject line)\b/.test(lower)) {
    return 'email marketing strategist';
  }
  if (/\b(article|blog|write|copy|slogan|tagline|script|story)\b/.test(lower)) {
    return 'senior content strategist and writer';
  }
  if (/\b(pitch deck|presentation|slides)\b/.test(lower)) {
    return 'presentation design specialist';
  }
  if (/\b(api|function|debug|code|javascript|python|typescript|sql|algorithm)\b/.test(lower)) {
    return 'senior software engineer';
  }
  if (/\b(data|analysis|analytics|chart|visualization|insight)\b/.test(lower)) {
    return 'data analyst';
  }
  if (/\b(marketing plan|campaign|go-to-market|brand)\b/.test(lower)) {
    return 'marketing strategist';
  }
  if (/\b(research|report|summary|brief|whitepaper)\b/.test(lower)) {
    return 'research analyst';
  }
  return 'multidisciplinary problem-solving assistant';
}

function polishObjective(text) {
  if (!text) return '';
  let trimmed = text.trim();
  trimmed = trimmed.replace(/^please\s+/i, '');
  trimmed = trimmed.replace(/^(can|could|would|will)\s+you\s+/i, '');
  trimmed = trimmed.replace(/^(i\s+(?:need|want)\s+(?:you|ya)\s+to\s+)/i, '');
  trimmed = trimmed.replace(/^(i\s+(?:need|want)\s+help\s+to\s+)/i, '');
  trimmed = trimmed.replace(/^(help\s+me\s+to\s+)/i, '');
  trimmed = trimmed.replace(/^make\s+/i, 'Create ');
  if (!/[.!?)]$/.test(trimmed)) {
    trimmed += '.';
  }
  return trimmed;
}

function formatBullet(sentence) {
  const formatted = formatSentence(sentence);
  return formatted.replace(/\.$/, '');
}

function buildImprovedPrompt(rawText) {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return rawText;
  }

  const sentences = splitSentences(rawText);
  const categories = classifySentences(sentences);
  const role = inferExpertRole(rawText);

  const sections = [];
  sections.push(`You are an experienced ${role}. Use the structured brief below to craft a thoughtful, outcome-focused response.`);

  if (categories.objective) {
    sections.push('🎯 Primary Objective');
    sections.push(`- ${formatBullet(polishObjective(categories.objective))}`);
  }

  const contextItems = [...categories.context, ...categories.other];
  if (contextItems.length > 0) {
    sections.push('🧭 Important Context');
    sections.push(...contextItems.map((item) => `- ${formatBullet(item)}`));
  }

  if (categories.steps.length > 0) {
    sections.push('🛠️ Recommended Approach Considerations');
    sections.push(...categories.steps.map((item) => `- ${formatBullet(item)}`));
  }

  const constraints = categories.constraints;
  if (constraints.length > 0) {
    sections.push('⚠️ Constraints & Guardrails');
    sections.push(...constraints.map((item) => `- ${formatBullet(item)}`));
  }

  const deliverables = categories.outputs.length > 0
    ? categories.outputs.map((item) => formatBullet(item))
    : ['Outline the deliverable you recommend and explain why it best serves the objective.'];
  sections.push('📦 Deliverables');
  sections.push(...deliverables.map((item) => `- ${item}`));

  const checklist = [
    'Call out any assumptions and ask for clarification before finalizing if critical details are missing.',
    'Highlight how your solution satisfies the objective and respects the stated constraints.',
  ];
  if (constraints.length === 0) {
    checklist.push('Surface relevant constraints (timeline, tone, length, tools) that should be confirmed with the user.');
  }
  if (categories.steps.length === 0) {
    checklist.push('Share a brief plan or recommended next steps to accomplish the work.');
  }

  sections.push('📝 Communication Checklist');
  sections.push(...checklist.map((item) => `- ${formatBullet(item)}`));

  sections.push('✅ Response Format');
  sections.push(
    '- Start with a concise summary of the solution.'
  );
  sections.push(
    '- Provide the deliverables in a well-structured format (headings, bullet lists, tables, or code blocks as appropriate).'
  );
  sections.push(
    '- End with optional follow-up questions or suggestions to refine the outcome.'
  );

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
}
