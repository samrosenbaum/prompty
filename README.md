# Prompty Chrome Extension

Prompty upgrades any rough AI request into a structured, high-impact prompt while you type—similar to how Grammarly polishes prose. Whenever you focus an input, textarea, or contenteditable field, Prompty offers a one-click "Improve with Prompty" action that rewrites your text into a clearer format AI systems can understand and execute.

## Features

- **Inline enhancement button** – Appears next to the field you are typing in on any webpage. Click it to instantly restructure the current text.
- **Prompt engineering heuristics** – Breaks your request into objective, persona, context, key details, process guidance, constraints, tone, and output expectations, ensuring the most important information is explicit.
- **Response checklist** – Adds a concise checklist so the AI knows how to approach the task and what to double-check.
- **Non-intrusive feedback** – Lightweight toast notifications confirm actions without hijacking your workflow.

## File Structure

```
manifest.json         # Chrome extension manifest (v3)
src/content.js        # Content script that injects the Prompty UX and prompt improver
src/style.css         # Styling for the floating action button and toast notifications
```

## Installation

1. Download or clone this repository.
2. (Optional) Add your own PNG icons in an `icons/` folder and reference them in `manifest.json` if you want a custom toolbar icon. Prompty works without icons, so you can skip this when sharing patches in environments that disallow binary files.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the project folder.
6. Navigate to any site with a text area, start typing a prompt, and hit **Improve with Prompty** to see the enhanced version.

## Stabilising the MVP in Chrome

1. Load the unpacked extension via `chrome://extensions` and pin the toolbar icon if desired.
2. Visit a few representative editors (simple `<textarea>`, Notion, Gmail compose). Focus the editor and confirm the floating **Improve with Prompty** button stays anchored above or below the field while you type, scroll, and resize the window.
3. Trigger the enhancement flow. The improved prompt should replace the original text while the toast announces success. If the button drifts, open DevTools and inspect the geometry snapshots stored in `window.__promptyDebug` (see below) to diagnose layout quirks.

## How it Works

The content script attaches listeners to any editable surface on the page. When activated, it:

1. Reads your current draft.
2. Splits it into sentences and classifies them as context, constraints, output expectations, or other key details.
3. Reassembles the request using a clean markdown structure (`Objective`, `Role or Persona`, `Context`, `Constraints`, `Tone & Style`, etc.).
4. Adds a response checklist encouraging the AI to clarify uncertainties and cover all requirements.
5. Shows the original prompt at the end for easy reference.

This deterministic transformation happens entirely in the browser—no APIs or external services required.

## Prompt Heuristic Reference

Prompty's heuristics recognise the following cues:

- **Role or Persona** – phrases like “act as…”, “take on the role…”, or “you are the…”.
- **Tone & Style** – adjectives such as “friendly”, “formal”, “conversational”, or explicit mentions of “tone”/“voice”.
- **Context** – background statements containing “because”, “working on”, “for my team”, etc.
- **Process Guidance** – sequencing words including “first”, “then”, “workflow”, or “step-by-step”.
- **Constraints** – explicit limits like “must”, “deadline”, “avoid”, or “only include”.
- **Output Expectations** – directions starting with “generate”, “list”, “deliver”, “respond with…”.

Sentences that do not match any heuristic fall under **Key Details** so they remain visible to the AI.

## Optional Debug Hooks

Open the DevTools console and inspect `window.__prompty` to call the exported helpers manually:

```js
window.__prompty.splitSentences('Write a formal email and deliver it in bullet points.');
window.__prompty.buildImprovedPrompt('Act as a travel agent...');
```

When the content script is active, Prompty also records lightweight debug information at `window.__promptyDebug` (latest target coordinates, last toast message). Reset the object when you want to clear the captured values.

## Accessibility & Performance Notes

- The floating button and toast honour `prefers-reduced-motion` to minimise animations for sensitive users.
- Buttons expose focus outlines and ARIA attributes so keyboard users and screen readers know when Prompty is available.
- Resize and scroll observers detach automatically when focus leaves an editor to avoid leaking resources on long-lived pages.

## Customisation Ideas

- Expand the heuristics to detect personas (“act as…”) or tones (“friendly, professional”) and map them to dedicated sections.
- Persist original prompts so the button toggles between raw and enhanced versions.
- Offer multiple enhancement styles (brainstorming, analysis, summarisation) via a small mode picker near the button.

Enjoy more productive conversations with your AI tools!
