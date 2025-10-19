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

  const contextItems = [...categories.context, ...categories.other];
  const contextSection = contextItems.length
    ? contextItems.map((item) => `- ${formatBullet(item)}`)
    : ['- No additional context provided. Confirm audience, tools, or environment as needed.'];

  const constraintItems = categories.constraints.length
    ? categories.constraints.map((item) => `- ${formatBullet(item)}`)
    : ['- Ask whether there are timeline, tone, formatting, or tooling constraints that must be respected.'];

  const deliverables = categories.outputs.length > 0
    ? categories.outputs.map((item) => `- ${formatBullet(item)}`)
    : ['- Recommend the most useful deliverable and describe why it aligns with the mission.'];

  const approachItems = categories.steps.length
    ? categories.steps.map((item) => `- ${formatBullet(item)}`)
    : ['- Outline a clear plan or set of steps before presenting the final deliverable.'];

  const checklist = [
    'Verify key assumptions and ask clarifying questions when requirements feel ambiguous or incomplete.',
    'Explain how your response directly advances the stated mission and respects the constraints.',
  ];

  if (constraintItems.length === 1 && constraintItems[0].includes('Ask whether')) {
    checklist.push('Surface any critical constraints (timeline, tone, length, dependencies) that should be confirmed.');
  }

  if (categories.steps.length === 0) {
    checklist.push('Share a recommended plan of attack before diving into detailed deliverables.');
  }

  const sections = [];
  sections.push(`You are an experienced ${role}. Carefully study the request and craft a thorough, outcome-focused response.`);
  sections.push('');
  sections.push('## Mission');
  sections.push(`- ${objective}`);
  sections.push('');
  sections.push('## Situational Context');
  sections.push(...contextSection);
  sections.push('');
  sections.push('## Constraints & Risks to Track');
  sections.push(...constraintItems);
  sections.push('');
  sections.push('## Expected Deliverables');
  sections.push(...deliverables);
  sections.push('');
  sections.push('## Suggested Approach');
  sections.push(...approachItems);
  sections.push('');
  sections.push('## Communication Guardrails');
  sections.push(...checklist.map((item) => `- ${formatBullet(item)}`));
  sections.push('');
  sections.push('## Clarity Suggestions for the Requester');
  sections.push(
    ...claritySuggestions.map((item) => `- ${formatBullet(item)}`)
  );
  sections.push('');
  sections.push('## When Responding');
  sections.push('- Start with a succinct status summary that shows you understand the mission.');
  sections.push('- Provide the deliverables in a clear structure (headings, bullet lists, tables, or code blocks).');
  sections.push('- Close with optional follow-up questions or suggestions to improve the outcome.');
  sections.push('');
  const originalLines = rawText
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  sections.push('---');
  sections.push('### Original Request');
  if (originalLines.length === 0) {
    sections.push('> (no original text captured)');
  } else {
    sections.push(originalLines.map((line) => `> ${line}`).join('\n'));
  }

  return sections.join('\n');
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
    analyzeClarity,
  };
}
