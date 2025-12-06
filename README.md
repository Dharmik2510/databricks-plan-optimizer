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

The application follows a modern **Client-Server** architecture (BFF pattern).

### 1. Frontend (`/frontend`) - Port 3000
**The Presentation Layer.** Built with **React 19**, **Vite**, **Tailwind CSS**, and **Recharts**.
*   **Core**: Manages UI state and renders the `EnhancedDagVisualizer`.
*   **Proxy**: Vite is configured to proxy API requests (`/api/*`) to the backend, avoiding CORS issues during development.
*   **Client**: Uses a custom `ApiClient` implementation to handle JWT authentication and token refreshing transparently.

### 2. Backend (`/backend`) - Port 3001
**The Application Layer.** Built with **NestJS**.
*   **API Gateway**: Exposes RESTful endpoints for the frontend.
*   **Business Logic**:
    *   `AnalysisModule`: Parses Spark DAGs and coordinates with Gemini.
    *   `ChatModule`: Handles conversational context and prompt engineering.
    *   `AuthModule`: Manages JWT issuance and validation.
*   **Database**: Uses Prisma ORM (SQLite for dev) to store user history and analysis results.

### 3. Shared (`/shared`)
**The Contract Layer.**
*   Typescript interfaces ensuring type safety between Frontend and Backend (e.g., `AnalysisResult`, `SparkNode`).

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or pnpm
*   Google Gemini API Key

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Dharmik2510/databricks-plan-optimizer.git
    cd databricks-plan-optimizer
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    cd backend && npm install
    cd ../frontend && npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root and/or backend directory with:
    ```env
    GEMINI_API_KEY=your_key_here
    DATABASE_URL="file:./dev.db"
    JWT_SECRET=your_secret
    ```

4.  **Run the Application**
    To run both Frontend and Backend concurrently:
    ```bash
    npm run dev:all
    ```
    *   Frontend: `http://localhost:3000`
    *   Backend: `http://localhost:3001`

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite, D3.js, Lucide React
*   **Backend**: NestJS, Prisma, Passport (Auth)
*   **AI**: Google GenAI SDK (Gemini 2.0 Flash)
