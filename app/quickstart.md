Here are the steps to run the app:

---

### Prerequisites

Make sure you have **Node.js** and **Bun** installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) — `npm install -g bun` or follow the Bun install guide

---

### 1. Set up environment variables

Create a `.env` file in sci-plan-nexus:

```bash
cd c:\Users\PC\Desktop\Hacknation5\frontend\sci-plan-nexus
copy .env.example .env   # if it exists, otherwise create manually
```

Add the required keys to `.env`:

```env
# Choose one LLM provider (default is groq)
LLM_PROVIDER=groq         # or: openai | gemini | stub

# API keys — only the one matching LLM_PROVIDER is needed
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# For literature retrieval (optional, falls back to mock if absent)
TAVILY_API_KEY=your_tavily_key

# Set to 1 to skip all LLM calls entirely (useful for UI testing)
# STUB_LLM=1
```

> **Quickest start with no API keys:** set `STUB_LLM=1` — the app will use mock data throughout.

---

### 2. Install dependencies

```bash
cd c:\Users\PC\Desktop\Hacknation5\frontend\sci-plan-nexus
bun install
```

---

### 3. Start the dev server

```bash
bun run dev
```

The app will be available at **http://localhost:5173** (or whichever port Vite picks — check the terminal output).

---

### Summary of available scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Run Prettier |