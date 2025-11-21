
# BrickOptima Architecture

This document outlines the high-level architecture of BrickOptima, a client-side SPA designed for analyzing Databricks/Spark execution plans using Generative AI.

## Data Flow Diagram (Mermaid)

```mermaid
graph TD
    User[User / Data Engineer]
    
    subgraph "Client Layer (React SPA)"
        UI[UI Components]
        State[App State (Context/Hook)]
        Vis[D3.js Visualizer]
        Chart[Recharts Metrics]
    end

    subgraph "Service Layer"
        GeminiSvc[Gemini Service]
        GithubSvc[GitHub Service]
        DBricksSvc[Databricks Service]
    end

    subgraph "External APIs"
        GeminiAPI[Google Gemini 2.0 API]
        GithubAPI[GitHub REST API]
        DBricksAPI[Databricks REST API]
    end

    User -- "Uploads Plan / Pastes Logs" --> UI
    UI -- "Trigger Analysis" --> State
    State -- "Analyze Content" --> GeminiSvc
    GeminiSvc -- "Prompt + Context" --> GeminiAPI
    GeminiAPI -- "JSON Analysis" --> GeminiSvc
    GeminiSvc -- "Parsed Result" --> State
    
    State -- "Update Data" --> Vis
    State -- "Update Data" --> Chart

    User -- "Connect Repo" --> UI
    UI -- "Fetch Code" --> GithubSvc
    GithubSvc -- "Get Tree/Content" --> GithubAPI
    GithubAPI -- "Source Code" --> GithubSvc
    GithubSvc -- "Repo Context" --> State

    User -- "Live Monitor" --> UI
    UI -- "Connect Cluster" --> DBricksSvc
    DBricksSvc -- "Poll Metrics" --> DBricksAPI
    DBricksAPI -- "Executor Stats" --> DBricksSvc
```

## Core Components

1.  **Gemini Service (`geminiService.ts`)**:
    *   Acts as the reasoning engine.
    *   Constructs prompts using system instructions tailored for Spark optimization.
    *   Parses unstructured text (logs) into structured JSON (DAG nodes, edges, metrics).

2.  **DAG Visualizer (`DagVisualizer.tsx`)**:
    *   Uses D3.js Force Simulation.
    *   Implements a topological sort algorithm to force a Left-to-Right flow, mimicking data lineage.
    *   Memoized for performance to handle large graphs without UI lag.

3.  **Live Monitor (`LiveMonitor.tsx`)**:
    *   Simulates a WebSocket connection (using `setInterval` in this demo).
    *   Visualizes real-time timeseries data (Throughput, Memory, GC).
    *   Designed to be hot-swapped with a real WebSocket hook in production.

4.  **Error Boundary (`ErrorBoundary.tsx`)**:
    *   Wraps the application to catch React lifecycle errors.
    *   Prevents "White Screen of Death" and provides a recovery mechanism.
