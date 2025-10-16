# Prompty Chrome Extension

Prompty upgrades any rough AI request into a structured, high-impact prompt while you type—similar to how Grammarly polishes prose. Whenever you focus an input, textarea, or contenteditable field, Prompty offers a one-click "Improve with Prompty" action that rewrites your text into a clearer format AI systems can understand and execute.

## Features

- **Inline enhancement button** – Appears next to the field you are typing in on any webpage. Click it to instantly restructure the current text.
- **Prompt engineering heuristics** – Breaks your request into objective, context, key details, constraints, and output expectations, ensuring the most important information is explicit.
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

## How it Works

The content script attaches listeners to any editable surface on the page. When activated, it:

1. Reads your current draft.
2. Splits it into sentences and classifies them as context, constraints, output expectations, or other key details.
3. Reassembles the request using a clean markdown structure (`Objective`, `Context`, `Constraints`, etc.).
4. Adds a response checklist encouraging the AI to clarify uncertainties and cover all requirements.
5. Shows the original prompt at the end for easy reference.

This deterministic transformation happens entirely in the browser—no APIs or external services required.

## Customisation Ideas

- Expand the heuristics to detect personas (“act as…”) or tones (“friendly, professional”) and map them to dedicated sections.
- Persist original prompts so the button toggles between raw and enhanced versions.
- Offer multiple enhancement styles (brainstorming, analysis, summarisation) via a small mode picker near the button.

Enjoy more productive conversations with your AI tools!
