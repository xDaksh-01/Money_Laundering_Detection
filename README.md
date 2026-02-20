# RIFT — Real-time Intelligence for Financial Transactions

> **AI-powered money laundering detection engine** that ingests raw transaction CSVs, builds a directed transaction graph, and runs a four-pass algorithm to surface fraud rings, suspicious accounts, and layered shell networks — all visualised in an interactive network graph.

**Live Demo:** [https://money-laundering-detection-1-2y0u.onrender.com/](https://money-laundering-detection-1-2y0u.onrender.com/)

> ⚠️ Hosted on Render free tier — expect a ~30 s cold-start if the service has been idle.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [System Architecture](#system-architecture)
3. [Algorithm Approach](#algorithm-approach)
4. [Suspicion Score Methodology](#suspicion-score-methodology)
5. [Installation & Setup](#installation--setup)
6. [Usage Instructions](#usage-instructions)
7. [Known Limitations](#known-limitations)
8. [Team Members](#team-members)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI 0.115, Uvicorn |
| **Graph Engine** | NetworkX 3.4 (MultiDiGraph) |
| **Data Processing** | Pandas 2.2, NumPy 1.26 |
| **Frontend** | React 19, Vite 6, JavaScript (ESM) |
| **Graph Visualisation** | React Force Graph / D3-based canvas |
| **HTTP Client** | Axios (120 s timeout) |
| **Containerisation** | Docker (single-image, multi-stage build) |
| **Hosting** | Render (free tier, Docker runtime) |
| **Validation** | Pydantic v2 |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               React 19 SPA  (Vite build)                  │  │
│  │                                                           │  │
│  │  FileUpload → POST /api/process (multipart/form-data)     │  │
│  │                                                           │  │
│  │  Renders:  SummaryCards · FraudTable · NetworkGraph       │  │
│  │            GraphCanvas  · ChainDetailPanel · Sidebar      │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │  HTTP  (same origin /api/*)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI  (Uvicorn, port 10000)                  │
│                                                                 │
│   GET  /api/health          — liveness probe                    │
│   POST /api/process         — main analysis endpoint            │
│   GET  /assets/*            — Vite static assets               │
│   GET  /{any}               — SPA catch-all → index.html       │
│                                                                 │
│  ┌───────────────┐    ┌─────────────────────────────────────┐   │
│  │ RIFTDataParser│    │          RiftAnalyzer               │   │
│  │               │    │                                     │   │
│  │  CSV → pandas │───▶│  Build MultiDiGraph                 │   │
│  │  DataFrame    │    │  Pass 1 → Cycle Detection           │   │
│  │  validation   │    │  Pass 2 → Smurfing Fan-In           │   │
│  └───────────────┘    │  Pass 3 → Smurfing Fan-Out          │   │
│                       │  Pass 4 → Layered Shell Networks     │   │
│                       │  Merchant Protection Filter          │   │
│                       │  → RiftOutput (Pydantic model)       │   │
│                       └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                          Docker Image
                    (Node 18 build + Python 3.11)
                         Render Free Tier
```

**Request lifecycle:**

1. User uploads a `.csv` file via the React frontend.
2. Axios sends a `multipart/form-data` POST to `/api/process` on the same origin.
3. FastAPI receives the file, hands it to `RIFTDataParser` for validation.
4. `RiftAnalyzer` builds a `nx.MultiDiGraph` and runs the four detection passes inside `run_in_threadpool` (keeps the async event loop unblocked).
5. A `RiftOutput` JSON response is returned and rendered as cards, tables, and an interactive force-directed graph.

---

## Algorithm Approach

The engine converts every row of the transaction CSV into a **directed edge** in a `MultiDiGraph` where nodes are account IDs and edge weights are amounts/timestamps. Four independent passes then scan the graph.

### Pass 1 — Circular Cycle Detection

**What it finds:** Closed loops of 3–6 accounts where money travels in a circle (A → B → C → A), a classic layering technique.

**Method:** `nx.strongly_connected_components()` filtered to SCCs where every node has exactly in-degree = 1 and out-degree = 1, and the number of edges equals the number of nodes (perfect ring topology).

**Complexity:** $O(V + E)$ — Tarjan's SCC algorithm is linear in the size of the graph.

**Scoring:** Base 80 + 4 × ring size, capped at 96.

---

### Pass 2 — Smurfing Fan-In

**What it finds:** A single collector account receiving money from ≥ 10 unique senders within a 72-hour sliding window — indicative of structuring / smurfing.

**Method:** Group all transactions by `receiver_id`. For groups with ≥ 10 unique senders, apply a two-pointer sliding-window timestamp check.

**Complexity:** $O(N \log N)$ per receiver group for the sort step; overall $O(T \log T)$ where $T$ is the number of transactions.

**Scoring:** Fixed 90 for all fan-in members.

---

### Pass 3 — Smurfing Fan-Out

**What it finds:** A single disperser account sending money to ≥ 10 unique receivers within 72 hours — funds being broken up and sprayed to mules.

**Method:** Mirrors Pass 2 but groups by `sender_id` and checks unique receivers.

**Complexity:** $O(T \log T)$.

**Scoring:** Fixed 90 for all fan-out members.

---

### Pass 4 — Layered Shell Networks

**What it finds:** Linear chains of ≥ 3 accounts where each node has exactly one outgoing edge (A → B → C → D), creating layers of intermediaries to obscure the money trail.

**Method:** For every node with in-degree ≤ 1 and out-degree = 1, greedily walk forward following the unique successor until the chain breaks or reaches 50 nodes.

**Complexity:** $O(V + E)$ — each node is visited at most once due to the `visited` set.

**Scoring:** Base 65 + 5 × chain length, capped at 95.

---

### Merchant Protection

Before any flagging, nodes are classified as **merchants** if they satisfy all three:
- `in_degree ≥ 25` (high volume of incoming payments)
- `out_degree ≤ 3` (rarely sends money)
- Active span ≥ 15 days

Merchants are excluded from all detection passes to prevent false positives on legitimate high-volume payees (e.g. e-commerce platforms).

---

### Cross-Pattern Overlap

After all four passes, accounts appearing in multiple rings are tagged with `bridge_nodes` and `overlap_with` fields, surfacing accounts that participate in more than one fraud typology simultaneously.

---

## Suspicion Score Methodology

Each account receives a **suspicion score** in the range `[0, 100]`.

| Pattern | Base Score | Modifier |
|---|---|---|
| Cycle | 80 | +4 per node in cycle (max 96) |
| Smurfing Fan-In | 90 | None |
| Smurfing Fan-Out | 90 | None |
| Layered Shell | 65 | +5 per chain hop (max 95) |

**Aggregation rules:**

- An account appearing in multiple rings takes the **maximum** score across all rings (not additive, to avoid synthetic inflation).
- Score is hard-capped at **100.0** in all cases.
- Merchants are **immune** — their score is never updated regardless of graph topology.
- The `role` field on each account reflects its structural position: `source` (ring initiator), `layer` (intermediary), or `collector` (fan-in recipient).

---

## Installation & Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### Clone

```bash
git clone https://github.com/xDaksh-01/Money_Laundering_Detection.git
cd Money_Laundering_Detection
```

### Backend

```bash
# Create and activate virtual environment
python -m venv rift_env

# Windows
.\rift_env\Scripts\activate
# macOS / Linux
source rift_env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn backend.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Swagger docs available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. Vite proxies all `/api/*` requests to port 8000 automatically — no manual URL config needed.

### Docker (single-image, mirrors production)

```bash
docker build -t rift-app .
docker run -p 10000:10000 rift-app
```

App available at `http://localhost:10000`.

---

## Usage Instructions

1. **Open the app** in your browser (local or the live demo URL above).
2. **Upload a CSV file** using the drag-and-drop panel. The file must contain these columns:

   | Column | Type | Description |
   |---|---|---|
   | `transaction_id` | string | Unique identifier per transaction |
   | `sender_id` | string | Source account |
   | `receiver_id` | string | Destination account |
   | `amount` | float | Transaction amount |
   | `timestamp` | datetime | Format: `YYYY-MM-DD HH:MM:SS` |

3. **Wait for analysis** — large files (10 k+ rows) may take 10–30 seconds.
4. **Review the Summary Cards** — total accounts, flagged accounts, rings detected, processing time.
5. **Explore Fraud Rings** in the table — filter by pattern type, expand each ring to see member accounts and total amount.
6. **Visualise the graph** — nodes are accounts, edges are transactions. Suspicious nodes are highlighted. Click a node to see its suspicion score and detected patterns in the detail panel.
7. **Download** results as JSON via the export button (if available).

A sample test file is provided at `data/test_input.csv`. Generate larger synthetic datasets with:

```bash
python data/generate_test_data.py
```

---

## Known Limitations

| Limitation | Detail |
|---|---|
| **Scale** | Tested up to ~50 k transactions. Very large graphs (500 k+ edges) may exceed Render's free-tier RAM (512 MB) and cause OOM crashes. |
| **Cold start** | Render free tier spins down after 15 minutes of inactivity. First request after idle takes ~30 s. |
| **Cycle cap** | Only cycles of length 3–6 are detected. Longer cycles are ignored to control false-positive rate. |
| **Temporal cycles** | The cycle detector uses graph topology only — it does not verify that edge timestamps are chronologically ordered around the cycle. |
| **Currency normalisation** | All amounts are treated as the same currency. Multi-currency datasets require pre-normalisation. |
| **No persistence** | Results exist only in memory for the duration of the session. Refreshing the page discards them. |
| **Single file** | Only one CSV can be analysed per session. Merging multiple files must be done before upload. |
| **Static thresholds** | Detection thresholds (e.g. `SMURF_MIN = 10`, `SMURF_WINDOW_HOURS = 72`) are hard-coded. There is no UI to tune them. |

---

## Team Members

| Name | Role |
|---|---|
| **Daksha Adhikari** | Backend / Graph Algorithms |
| **Sai Sharan** | Backend / Data Pipeline |
| **Aaron Fernandes** | Frontend / Visualisation |
| **Vijval Gupta** | Frontend / UI & Integration |
