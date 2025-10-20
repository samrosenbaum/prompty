const PROMPTY_BUTTON_ID = 'prompty-action-button';
const PROMPTY_TOAST_ID = 'prompty-toast';
const PROMPTY_POSITION_STORAGE_KEY = 'promptyButtonPosition';
const PROMPTY_SHORTCUT_DESCRIPTION = 'Ctrl + Alt + P';

let currentTarget = null;
let manualPosition = loadManualPosition();
let buttonManuallyHidden = false;
let isDraggingButton = false;
let dragStartInfo = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let buttonMovedDuringDrag = false;

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
  btn.classList.add('prompty-hidden', 'prompty-draggable');
  btn.dataset.wasDragging = 'false';
  btn.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }
    // Prevent the focused element from losing focus while we work.
    event.preventDefault();
    const rect = btn.getBoundingClientRect();
    dragStartInfo = {
      startX: event.clientX,
      startY: event.clientY,
      rectTop: rect.top,
      rectLeft: rect.left,
    };
    isDraggingButton = true;
    buttonMovedDuringDrag = false;
  });
  btn.addEventListener('click', () => {
    if (btn.dataset.wasDragging === 'true') {
      btn.dataset.wasDragging = 'false';
      return;
    }
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
  if (manualPosition) {
    applyManualPosition();
  }
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

function loadManualPosition() {
  try {
    const raw = window.localStorage.getItem(PROMPTY_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.top === 'number' &&
      typeof parsed.left === 'number'
    ) {
      return {
        top: Math.max(8, parsed.top),
        left: Math.max(8, parsed.left),
      };
    }
  } catch (error) {
    // Ignore storage issues silently so we never break the host page.
  }
  return null;
}

function saveManualPosition(position) {
  try {
    if (!position) {
      window.localStorage.removeItem(PROMPTY_POSITION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PROMPTY_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch (error) {
    // Ignore storage issues silently.
  }
}

function applyManualPosition() {
  if (!manualPosition) {
    return false;
  }
  button.style.position = 'fixed';
  button.style.top = `${manualPosition.top}px`;
  button.style.left = `${manualPosition.left}px`;
  button.classList.add('prompty-manual-position');
  return true;
}

function isButtonManuallyPositioned() {
  return Boolean(manualPosition);
}

function ensureManualPositionInView() {
  if (!manualPosition) {
    return;
  }
  const padding = 8;
  const width = button.offsetWidth || 160;
  const height = button.offsetHeight || 40;
  const maxLeft = Math.max(padding, window.innerWidth - width - padding);
  const maxTop = Math.max(padding, window.innerHeight - height - padding);
  const nextLeft = Math.min(Math.max(padding, manualPosition.left), maxLeft);
  const nextTop = Math.min(Math.max(padding, manualPosition.top), maxTop);
  manualPosition = { top: nextTop, left: nextLeft };
  if (!buttonManuallyHidden) {
    applyManualPosition();
  }
  saveManualPosition(manualPosition);
}

function toggleShortcutVisibility() {
  buttonManuallyHidden = !buttonManuallyHidden;
  if (buttonManuallyHidden) {
    hideButton({ keepTarget: true });
    showToast(`Prompty button hidden. Press ${PROMPTY_SHORTCUT_DESCRIPTION} to show it again.`, 'info');
    return;
  }
  const active = currentTarget || (isEditableElement(document.activeElement) ? document.activeElement : null);
  if (active) {
    showButton(active);
  }
  showToast(`Prompty button visible. Use ${PROMPTY_SHORTCUT_DESCRIPTION} to hide it.`, 'info');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function handleButtonMouseMove(event) {
  if (!isDraggingButton || !dragStartInfo) {
    return;
  }
  event.preventDefault();
  const deltaX = event.clientX - dragStartInfo.startX;
  const deltaY = event.clientY - dragStartInfo.startY;
  if (!buttonMovedDuringDrag) {
    const dragThreshold = 3;
    if (Math.abs(deltaX) < dragThreshold && Math.abs(deltaY) < dragThreshold) {
      return;
    }
    buttonMovedDuringDrag = true;
    button.classList.add('prompty-dragging');
    button.classList.add('prompty-manual-position');
    const { rectTop, rectLeft } = dragStartInfo;
    button.style.position = 'fixed';
    button.style.top = `${rectTop}px`;
    button.style.left = `${rectLeft}px`;
    dragOffsetX = dragStartInfo.startX - rectLeft;
    dragOffsetY = dragStartInfo.startY - rectTop;
  }
  const padding = 8;
  const maxLeft = Math.max(padding, window.innerWidth - button.offsetWidth - padding);
  const maxTop = Math.max(padding, window.innerHeight - button.offsetHeight - padding);
  const newLeft = clamp(event.clientX - dragOffsetX, padding, maxLeft);
  const newTop = clamp(event.clientY - dragOffsetY, padding, maxTop);
  manualPosition = { top: newTop, left: newLeft };
  button.style.left = `${newLeft}px`;
  button.style.top = `${newTop}px`;
}

function handleButtonMouseUp(event) {
  if (!isDraggingButton) {
    return;
  }
  if (buttonMovedDuringDrag) {
    event.preventDefault();
    button.dataset.wasDragging = 'true';
    window.setTimeout(() => {
      button.dataset.wasDragging = 'false';
    }, 0);
    ensureManualPositionInView();
    saveManualPosition(manualPosition);
  }
  button.classList.remove('prompty-dragging');
  isDraggingButton = false;
  dragStartInfo = null;
  buttonMovedDuringDrag = false;
}

function handleGlobalKeydown(event) {
  if (event.repeat) {
    return;
  }
  if (event.ctrlKey && event.altKey && !event.shiftKey && event.code === 'KeyP') {
    event.preventDefault();
    toggleShortcutVisibility();
  }
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
  if (isButtonManuallyPositioned()) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const top = scrollY + rect.top - button.offsetHeight - 8;
  const left = scrollX + rect.right - button.offsetWidth;
  button.classList.remove('prompty-manual-position');
  button.style.position = 'absolute';
  button.style.top = `${Math.max(scrollY + 8, top)}px`;
  button.style.left = `${Math.max(8 + scrollX, left)}px`;
}

function showButton(target) {
  currentTarget = target;
  if (buttonManuallyHidden) {
    return;
  }
  button.classList.remove('prompty-hidden');
  if (isButtonManuallyPositioned()) {
    ensureManualPositionInView();
  } else {
    positionButtonFor(target);
  }
}

function hideButton(options = {}) {
  const { keepTarget = false } = options;
  button.classList.add('prompty-hidden');
  if (!keepTarget) {
    currentTarget = null;
  }
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
    styleTone: [],
    format: [],
    other: [],
  };
  if (sentences.length > 0) {
    categories.objective = sentences[0];
  }
  const rest = sentences.slice(1);
  const constraintRegex = /(must|should|need to|require|limit|avoid|never|do not|don't|cannot|deadline|within)/i;
  const outputRegex = /(provide|return|output|deliver|format|list|summarize|write|generate|give me|produce|draft)/i;
  const formatRegex = /(deliver (?:it|this) as|output as|return as|export as|provide (?:it|this) as|final (?:file|format)|presentation deck|prototype|working artifact|step-by-step guide|checklist|report)/i;
  const stepRegex = /(first|then|next|after|before|step|process)/i;
  const contextRegex = /(because|so that|for (?:my|our)|i am|i'm|we are|audience|background|current|existing|using|working on|project|goal|objective|purpose)/i;
  const styleRegex = /(tone|style|voice|aesthetic|vibe|mood|feel|brand|should sound|should feel|look like|design like|similar to|".*" inspired|modern|minimalist|playful|professional)/i;

  for (const sentence of rest) {
    const lowerMatch = sentence;
    if (constraintRegex.test(lowerMatch)) {
      categories.constraints.push(sentence);
      continue;
    }
    if (formatRegex.test(lowerMatch)) {
      categories.format.push(sentence);
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
    if (styleRegex.test(lowerMatch)) {
      categories.styleTone.push(sentence);
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

function analyzeClarity(rawText, sentences) {
  const suggestions = [];
  const seen = new Set();

  const addSuggestion = (message) => {
    if (!message || seen.has(message)) {
      return;
    }
    seen.add(message);
    suggestions.push(message);
  };

  const vagueTimeRegex = /(\bASAP\b|as soon as possible|\bsoon\b|right away|whenever|later|some time)/i;
  const vagueTimeMatch = rawText.match(vagueTimeRegex);
  if (vagueTimeMatch) {
    addSuggestion(
      `Clarify the exact timeline instead of saying "${vagueTimeMatch[0]}".`
    );
  }

  const vagueThingRegex = /(\bthing(s)?\b|\bstuff\b|something|anything)/i;
  const vagueThingMatch = rawText.match(vagueThingRegex);
  if (vagueThingMatch) {
    addSuggestion(
      `Replace vague wording like "${vagueThingMatch[0]}" with the specific item or outcome you expect.`
    );
  }

  const etcMatch = rawText.match(/\betc\.?\b|and so on|and more/i);
  if (etcMatch) {
    addSuggestion(
      `List the remaining examples instead of using "${etcMatch[0]}" so the assistant knows what to cover.`
    );
  }

  const indefiniteQuantityRegex = /\b(a few|a couple|several|some)\s+(?!one\b|body\b|thing\b|where\b|time\b)([a-z]+)/i;
  const quantityMatch = rawText.match(indefiniteQuantityRegex);
  if (quantityMatch) {
    addSuggestion(
      `Provide a concrete quantity instead of saying "${quantityMatch[0]}".`
    );
  }

  const pronounActionRegex = /\b(make|fix|improve|change|update|handle|work on|polish|adjust|optimize)\s+(it|this|that|them)\b/i;
  const pronounActionMatch = rawText.match(pronounActionRegex);
  if (pronounActionMatch) {
    addSuggestion(
      `Specify what "${pronounActionMatch[2]}" refers to when asking to ${pronounActionMatch[1]} it.`
    );
  }

  const minimalWordThreshold = 12;
  const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < minimalWordThreshold) {
    addSuggestion('Add more context so Prompty understands the audience, purpose, and constraints.');
  }

  const sentencesNeedingSubjects = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return /\b(it|this|that|they|them)\b/.test(lower) && !/\b(for|about|regarding)\b/.test(lower);
  });
  if (sentencesNeedingSubjects.length > 0) {
    addSuggestion('Clarify who or what pronouns like "it" or "they" refer to.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Prompty did not detect unclear phrasing, but double-check that goals, audience, and constraints are explicit.');
  }

  return suggestions;
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
  const claritySuggestions = analyzeClarity(rawText, sentences);

  const objective = categories.objective
    ? formatBullet(polishObjective(categories.objective))
    : 'Clarify the user\'s primary goal before proposing a solution.';

  const contextSection = categories.context.length
    ? categories.context.map((item) => `- ${formatBullet(item)}`)
    : ['- Audience, use case, and existing assets were not provided. Confirm these details.'];

  const constraintSection = categories.constraints.length
    ? categories.constraints.map((item) => `- ${formatBullet(item)}`)
    : ['- Surface timeline, budget, technical limits, or brand rules that could affect the plan.'];

  const deliverables = categories.outputs.length
    ? categories.outputs.map((item) => `- ${formatBullet(item)}`)
    : ['- Spell out the concrete deliverables you expect so the assistant can respond with precision.'];

  const approachSection = categories.steps.length
    ? categories.steps.map((item) => `- ${formatBullet(item)}`)
    : ['- Outline a step-by-step approach that explains how you will tackle the work.'];

  const styleToneSection = categories.styleTone.length
    ? categories.styleTone.map((item) => `- ${formatBullet(item)}`)
    : ['- Describe the desired tone, aesthetic, or brand personality to guide the creative direction.'];

  const formatSection = categories.format.length
    ? categories.format.map((item) => `- ${formatBullet(item)}`)
    : ['- Specify the delivery format (mockups, copy deck, code block, etc.) so the output is usable immediately.'];

  const otherInsights = categories.other.length
    ? categories.other.map((item) => `- ${formatBullet(item)}`)
    : [];

  const clarifyingQuestions = [];
  if (categories.context.length === 0) {
    clarifyingQuestions.push('Who is the primary audience or end user for this work?');
  }
  if (categories.constraints.length === 0) {
    clarifyingQuestions.push('Are there timeline, budget, or technical constraints I must respect?');
  }
  if (categories.styleTone.length === 0) {
    clarifyingQuestions.push('What tone, aesthetic, or brand references should guide the output?');
  }
  if (categories.format.length === 0) {
    clarifyingQuestions.push('How should the final answer be delivered so you can use it immediately?');
  }

  const clarityPrompts = claritySuggestions.map((item) => item.replace(/\.$/, ''));
  clarifyingQuestions.push(...clarityPrompts);

  const checklist = [
    'Verify key assumptions and ask clarifying questions when requirements feel ambiguous or incomplete.',
    'Explain how your response advances the objective while honoring every constraint and requirement.',
    'Summarize the proposed plan before presenting the detailed deliverables.',
  ];

  const lines = [];
  lines.push('# Prompty Enhanced Prompt');
  lines.push('');
  lines.push('## Ready-to-Send Prompt');
  lines.push(`You are an experienced ${role}. Use the structure below to craft a thorough, outcome-focused response.`);
  lines.push('');
  lines.push('### Objective');
  lines.push(`- ${objective}`);
  lines.push('');
  lines.push('### Key Context');
  lines.push(...contextSection);
  lines.push('');
  lines.push('### Constraints & Requirements');
  lines.push(...constraintSection);
  lines.push('');
  lines.push('### Deliverables');
  lines.push(...deliverables);
  lines.push('');
  if (otherInsights.length) {
    lines.push('### Additional Notes');
    lines.push(...otherInsights);
    lines.push('');
  }
  lines.push('### Suggested Approach');
  lines.push(...approachSection);
  lines.push('');
  lines.push('### Style & Tone');
  lines.push(...styleToneSection);
  lines.push('');
  lines.push('### Output Format');
  lines.push(...formatSection);
  lines.push('');
  lines.push('## Clarifying Questions to Ask the Requester');
  if (clarifyingQuestions.length) {
    lines.push(...clarifyingQuestions.map((item) => `- ${formatBullet(item)}`));
  } else {
    lines.push('- No clarifying questions needed—the brief is already specific.');
  }
  lines.push('');
  lines.push('## Response Checklist for the Assistant');
  lines.push(...checklist.map((item) => `- ${formatBullet(item)}`));
  lines.push('');

  const originalLines = rawText
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.push('---');
  lines.push('### Original Request');
  if (originalLines.length === 0) {
    lines.push('> (no original text captured)');
  } else {
    lines.push(originalLines.map((line) => `> ${line}`).join('\n'));
  }

  return lines.join('\n');
}

document.addEventListener('mousemove', handleButtonMouseMove, true);
document.addEventListener('mouseup', handleButtonMouseUp, true);
document.addEventListener('keydown', handleGlobalKeydown, true);

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
    if (currentTarget && !buttonManuallyHidden && !isButtonManuallyPositioned()) {
      positionButtonFor(currentTarget);
    }
  },
  true
);

window.addEventListener('resize', () => {
  if (isButtonManuallyPositioned()) {
    ensureManualPositionInView();
    return;
  }
  if (currentTarget && !buttonManuallyHidden) {
    positionButtonFor(currentTarget);
  }
});

// Export helpers for testing if needed.
if (typeof window !== 'undefined') {
  window.__prompty = {
    buildImprovedPrompt,
    splitSentences,
    classifySentences,
    analyzeClarity,
  };
}
