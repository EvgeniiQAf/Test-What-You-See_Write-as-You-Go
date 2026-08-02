# Release Notes - v3.0.0

**Release Date**: August 2, 2026

TWYS QA Helper v3.0.0 introduces **OpenAI Whisper Voice Control Integration**, **AI Test Generation Enforcements**, **TPM Rate-Limit Protection**, and **Unified Smart Assistant UX**.

---

## 🚀 What's New in v3.0.0

### 🎙️ OpenAI Whisper Voice Control
- **High-Precision Voice Dictation**: Integrated `MediaRecorder` audio capture with backend endpoint `/api/transcribe` powered by OpenAI Whisper-1 (`whisper-1`).
- **Single Tab-Origin Permission Flow**: Microphone access is requested on active web tab origins, popping Chrome native `"Allow / Block"` prompt once and saving permission permanently.
- **Auto-Formatting & Deduplication**: Speech transcripts auto-format test markers (e.g. `Test 1: ...`) with a 4-second deduplication guard preventing duplicate text insertion.

### 🏷️ UI Entity Quoting & Highlighting
- **Automatic Quotes**: All UI component titles, button names, section names, screen titles, and field labels (e.g. `"Person Paid"`, `"Overview"`, `"Billing Facility"`, `"Submit"`) are automatically wrapped in double quotes `""` in generated test case titles, preconditions, steps, and expected results.

### 🛡️ OpenAI Token Limit Protection (429 Prevention)
- **Context Budget Capping**: HTML snippets are automatically capped at 3,500 characters (~900 tokens) and conversation history is trimmed to 6 turns, guaranteeing prompt size stays under 5,000 tokens (well below OpenAI Tier 1/2 30,000 TPM limit).

### 🤖 Smart Assistant & UX Streamlining
- **Unified UX**: Removed `#bgt-generate-tests` checkbox. The assistant automatically detects test generation intent and renders importable Testmo/Testomat cards.
- **Preconditions Hardening**: Banned mentions of extension names (`TWYS`, `Side Panel`, `QA Helper`) and enforced generalized precondition data (e.g. *"Any available email is opened"*).
- **Session Reset**: Added `🗑️` clear session button at top bar to clear state and history instantly.
