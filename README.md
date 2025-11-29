
# BrickOptima 🚀

**BrickOptima** is an AI-powered observability and optimization platform for Databricks and Apache Spark workloads. It transforms raw, complex execution plans (DAGs) into interactive visualizations and provides actionable, code-level optimization suggestions using Google Gemini 2.0.

![BrickOptima Dashboard](https://via.placeholder.com/800x400?text=BrickOptima+Dashboard+Preview)

## Key Features

*   **Visual DAG Analysis**: Interactive D3.js visualization of Spark Physical Plans with bottleneck highlighting.
*   **AI Performance Consultant**: Chat with your execution plan using Gemini 2.0 Flash.
*   **Predictive Analytics**: Forecast performance at 10x/100x scale and detect regressions.
*   **Code Traceability**: Map execution plan nodes directly to your GitHub source code.
*   **Live Monitor**: Simulate real-time cluster telemetry (Throughput, GC, Shuffle).

## 🏗️ Project Architecture

The application follows a modular **Client-Service** architecture, organized to ensure separation of concerns and future scalability. While currently running as a single-page application (SPA), the codebase is structured to easily split into a distinct frontend and backend server.

### 1. Frontend (`/frontend`)
**The Presentation Layer.** Built with React 19, Tailwind CSS, and Recharts.
*   **`components/`**: Contains all UI elements, from the D3.js `EnhancedDagVisualizer` to the `ChatInterface`. These components are "dumb" regarding business logic; they simply render data provided by the API.
*   **`App.tsx`**: The main controller managing application state (routing, tabs, global error handling).
*   **`api.ts`**: The Client-Side Interface. This file acts as the gateway for the frontend to request data. Currently, it wraps direct calls to the backend, but it is designed to be replaced with HTTP `fetch` or `axios` calls without changing any UI code.

### 2. Backend (`/backend`)
**The Business Logic Layer.** Handles data processing, AI reasoning, and external integrations.
*   **`services/`**:
    *   **`llm.ts`**: Manages interactions with the Google Gemini API, including prompt engineering and context management.
    *   **`analytics.ts`**: The **Predictive Engine**. Contains the math for regression models, scaling simulations, and cost estimation logic.
    *   **`github.ts`**: Handles fetching and parsing code from repositories.
    *   **`codeAnalysis.ts`**: A robust engine that parses Python/Scala/SQL to map ASTs (Abstract Syntax Trees) to Spark DAG nodes.
*   **`api.ts`**: The Server-Side Interface. This defines the public API surface of the backend. It aggregates functionality from various services into a clean, callable API.

### 3. Shared (`/shared`)
**The Contract Layer.**
*   **`types.ts`**: Contains all TypeScript interfaces (`AnalysisResult`, `DagNode`, `OptimizationTip`). This ensures that both the Frontend and Backend speak the exact same language, providing end-to-end type safety.

## 🔌 The Pluggable Interface

The connection between Frontend and Backend is defined in **`backend/api.ts`** and consumed by **`frontend/api.ts`**.

**Current State (Serverless/Monolith):**
```typescript
// frontend/api.ts
import { API } from '../backend/api';
export const client = API; // Direct function invocation
```

**Future State (Microservices):**
To migrate to a real backend server, you only need to update **`frontend/api.ts`**:
```typescript
// frontend/api.ts
export const client = {
  analyzeDag: (content) => fetch('/api/analyze', { method: 'POST', body: ... }),
  predictAtScale: (data) => fetch('/api/predict', { ... }),
  // ...
};
```
*No changes are required in the UI components.*

## 🚀 Getting Started

1.  **Clone the repository.**
2.  **Set your API Key**: Ensure `process.env.API_KEY` is set with a valid Google Gemini API key.
3.  **Run the app**: The entry point is `index.tsx`.

## 🛠️ Tech Stack

*   **Core**: React 19, TypeScript
*   **AI**: Google GenAI SDK (Gemini 2.5 Flash)
*   **Visualization**: D3.js (Force-Directed Graphs), Recharts (Timeseries/Bar charts)
*   **Styling**: Tailwind CSS, Lucide React (Icons)
