
<div align="center">
  <img src="logo_axiomdesk.png" alt="AI Scientist Logo" width="140" />
  <h1>🧪 AI Scientist</h1>
  <p><em>Science moves at the speed of thought. Experiment planning shouldn't move at the speed of paperwork.</em></p>
  <p><strong>AI-powered copilot for generating executable experiment plans from scientific hypotheses.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tavily-FF6B35?style=for-the-badge&logo=searchengin&logoColor=white" alt="Tavily" />
    <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </p>
</div>

---

## 🚀 Overview

AI Scientist is an end-to-end platform that transforms natural language scientific ideas into **structured, lab-ready experimental plans**. It integrates literature analysis, protocol generation, material sourcing, cost estimation, and validation strategies into a single intelligent workflow.

The system is designed to **accelerate research workflows**, especially in contexts using real-world datasets such as **Moroccan medical reports**, ensuring grounded, practical, and context-aware outputs.

---

## ✨ Key Features

- 🧠 Hypothesis → Experiment pipeline  
- 📚 Literature review & novelty detection  
- 🧪 Automated protocol generation  
- 🧾 Materials & supplier recommendations  
- 💰 Budget estimation  
- ⏱ Timeline planning  
- ✅ Validation strategy generation  
- 🔁 Scientist feedback loop for continuous improvement  

---

## 🏗️ Project Structure

```bash
ai-scientist/
│
├── frontend/                # UI (React / Next.js)
├── backend/                 # API & core logic (FastAPI)
│   ├── api/                 # Routes & schemas
│   ├── core/                # Orchestrator & agents
│   ├── retrieval/           # Literature search modules
│   ├── models/              # LLM & embeddings interface
│   ├── services/            # Cost, timeline, suppliers
│   └── utils/               # Helpers & validators
│
├── database/                # Schema & migrations
├── data/                    # Datasets (protocols, reagents, reports)
├── experiments/             # Notebooks & evaluation
├── tests/                   # Unit & integration tests
├── scripts/                 # Data ingestion & setup scripts
├── docs/                    # Architecture & documentation
│
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
````

---

## ⚙️ Tech Stack

* **Frontend:** React / Next.js
* **Backend:** FastAPI (Python)
* **Database:** PostgreSQL
* **Vector DB:** Chroma / Weaviate / Pinecone
* **LLMs:** OpenAI / open-source models
* **Orchestration:** LangChain / LangGraph
* **Deployment:** Docker

---

## 🔄 System Workflow

1. User inputs a scientific hypothesis
2. Literature retrieval & novelty analysis
3. Multi-agent planning system generates:

   * Protocol
   * Materials list
   * Budget
   * Timeline
   * Validation plan
4. Results displayed in UI
5. Scientist reviews and provides feedback
6. System learns and improves over time

---

## 📊 Data Sources

* Scientific literature APIs (PubMed, Semantic Scholar)
* Protocol databases
* Reagent & supplier catalogs
* **Moroccan medical reports (for contextual grounding)**

---

## 🧪 Example Use Case

> Input: "Does compound X reduce inflammation in patients with condition Y?"

Output:

* Step-by-step experimental protocol
* Required reagents & suppliers
* Estimated cost and duration
* Validation metrics and expected outcomes

---

## 🛠️ Setup Instructions

```bash
# Clone repository
git clone https://github.com/your-username/ai-scientist.git
cd ai-scientist

# Setup environment
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Run backend
uvicorn backend.app:app --reload

# Run frontend
cd frontend
npm install
npm run dev
```

---

## 🧩 Future Improvements

* Fine-tuned models on domain-specific datasets
* Real-time collaboration for research teams
* Integration with lab equipment / ELN systems
* Advanced evaluation benchmarks

---

## 🤝 Contributing

Contributions are welcome. Please open an issue or submit a pull request.

---

## 📄 License

MIT License

---

## 👥 Team

* Abderrahmane JABIRI
* Ismail ELADRAOUI
* Saâd QACIF
* El Yazid TEBBAA

---

## 📌 Tagline

> From hypothesis to experiment — powered by AI.

```
```
