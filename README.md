# Test-What-You-See (TWYS) — Write-as-You-Go 🚀

> Turn visual exploratory testing into living test documentation. Select UI elements, describe test intent, and let AI generate structured test cases (Classic Steps & BDD Gherkin) synced directly to **Testomat.io** & **Testmo**.

---

## ✨ Features & Highlights

- **🎯 Visual Element Selection (`Shift + Click`):** Click any element on any live website to inspect its DOM, HTML attributes, and screenshots with real-time numbered badges (`1️⃣`, `2️⃣`, `3️⃣`).
- **🪟 Auto-Detachable Floating Desktop Window:** Drag the panel header to the edge of Chrome to pop it out into an independent OS window on a 2nd or 3rd monitor.
- **💡 AI Edge Case Suggestions & Quick Presets:** Smart chips (`⚡ Table Columns`, `⚡ Dropdown`, `💡 Required Field`, `💡 Max Length / Boundary`) dynamically suggest QA edge cases based on inspectable HTML tags.
- **🚀 Native Integration with Testomat.io & Testmo:** Save approved test cases directly into your test suites in **Testomat.io** or **Testmo** with one click.
- **📋 Flexible Export:** Copy clean Markdown formatted test cases for Jira / Slack, or export structured CSV files for offline reporting.
- **🛡️ Token Compression & Rate Limit Protection:** Built-in HTML pruning and message history truncation keep LLM prompts fast, compact, and immune to 429 TPM errors.

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **Browser**: Google Chrome or Chromium-based browser
- **AI Credentials**: OpenAI API Key or Anthropic Claude API Key

---

### 2. Backend Server Setup (`/server`)

1. Clone the repository:
   ```bash
   git clone https://github.com/EvgeniiQAf/Test-What-You-See.-Write-as-You-Go..git
   cd Test-What-You-See.-Write-as-You-Go./server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment configuration file `.env`:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` variables:
   ```env
   # Server Port
   PORT=3000

   # Active LLM Provider: "openai" | "claude"
   ACTIVE_LLM=openai
   OPENAI_API_KEY="sk-proj-YOUR_OPENAI_KEY_HERE"

   # Active Test Management System (TMS): "testomat" | "testmo"
   ACTIVE_TMS=testomat

   # Testomat.io API Key
   TESTOMAT_API_KEY="tstmt_YOUR_TESTOMAT_KEY_HERE"

   # Testmo Settings (Optional if using Testmo)
   TESTMO_URL="https://yourcompany.testmo.net"
   TESTMO_API_KEY="YOUR_TESTMO_API_KEY"
   ```

5. Start the backend server in development mode:
   ```bash
   npm run dev
   ```
   *The server will run on `http://localhost:3000`.*

---

### 3. Chrome Extension Setup (`/extension`)

1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. In the top-right corner, turn ON **Developer mode** (Режим розробника).
3. Click **Load unpacked** (Завантажити распаковане розширення).
4. Select the `extension` folder from this repository.
5. The **Browser GPT Testmo Helper** extension icon will appear in your Chrome toolbar!

---

## 🎮 How to Use

1. **Open any web application** in Chrome (e.g., LinkedIn, Jira, or your app).
2. **Select Elements:** Hold `Shift` and `Click` any UI button, input, or table column.
3. **Use Presets or Type Prompt:** Click a preset button like `⚡ Table Columns` or `💡 Required Field`, or type your custom instruction (e.g., *"треба написати 1 тест на цю кнопку"*).
4. **Generate & Edit:** Review generated test cases in Ukrainian & English. Edit titles, preconditions, or steps inline inside preview cards.
5. **Push or Export:** Click **Approve** to push directly to **Testomat.io** / **Testmo**, or click **📋 Copy Markdown** / **📄 Export CSV**.
6. **Pop Out Panel:** Drag the top header of the extension panel to the edge of Chrome or click **`↗️`** to move the panel onto a 2nd screen!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Shift + Click` | Select UI element on page |
| `Alt + Shift + F` | Toggle extension panel open / closed |
| `Alt + Shift + S` | Capture instant tab screenshot |

---

## 🧪 Running Automated Tests

```bash
cd server
npm test
```

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for details.
