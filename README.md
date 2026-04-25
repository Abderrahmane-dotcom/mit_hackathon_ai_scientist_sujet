
# 🧪 AI Scientist

**AI-powered copilot for generating executable experiment plans from scientific hypotheses.**

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
* Saâd QACID
* El Yazid TEBBAA

---

## 📌 Tagline

> From hypothesis to experiment — powered by AI.

```
```
