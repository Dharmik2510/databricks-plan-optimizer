# BrickOptima Architecture

This document describes the Technical Architecture of BrickOptima, a platform for analyzing Databricks/Spark execution plans using Generative AI. The system is built as a distributed application with a distinct **Frontend** (React) and **Backend** (NestJS).

## High-Level Architecture

The application implements the **Backend for Frontend (BFF)** pattern. The React UI is the consumer, and the NestJS Backend serves as the gateway to all data logic, AI services, and database persistence.

### Data Flow Diagram (Mermaid)

```mermaid
graph TD
    User[User / Data Engineer]
    
    subgraph "Frontend (Port 3000)"
        UI[React Components]
        APIClient[ApiClient Class]
        Vite[Vite Dev Server (Proxy)]
    end

    subgraph "Backend (Port 3001)"
        Controller[API Controller]
        Auth[Auth Guard]
        Service[Service Layer]
        Prisma[Prisma ORM]
    end

    subgraph "External Services"
        Gemini[Google Gemini API]
        DB[SQLite Database]
    end

    %% Request Flow
    User -- "1. Uploads DAG / Sends Chat" --> UI
    UI -- "2. Invokes Method" --> APIClient
    APIClient -- "3. HTTP Request (/api/*)" --> Vite
    Vite -- "4. Proxies Request" --> Controller
    
    Controller -- "5. Validates Token" --> Auth
    Auth -- "6. Returns Context" --> Controller
    Controller -- "7. Calls Business Logic" --> Service
    
    Service -- "8. Queries Data" --> Prisma
    Prisma -- "9. Read/Write" --> DB
    
    Service -- "10. AI Inference" --> Gemini
    Gemini -- "11. JSON Response" --> Service
    
    Service -- "12. Returns DTO" --> Controller
    Controller -- "13. JSON Response" --> UI
```

## 🔄 Request Lifecycle: How a Call Works

Here is a step-by-step breakdown of what happens when a user triggers an action (e.g., "Analyze Plan").

### 1. User Interaction (Frontend)
*   **Action**: The user pastes a Spark Execution Plan into the `EnhancedDagVisualizer` component and clicks "Analyze".
*   **State Update**: The component sets its internal loading state to `true`.

### 2. Client-Side API Call
*   **Invocation**: The component calls `apiClient.post('/analysis/analyze', { content: planText })` defined in `frontend/src/api/client.ts`.
*   **Authentication**: The `ApiClient` automatically retrieves the JWT `accessToken` from `localStorage` and attaches it to the `Authorization` header (`Bearer <token>`).
*   **Token Refresh (Auto)**: If the token is expired (401), `ApiClient` pauses the request, calls `/auth/refresh` to get a new token, retries the original request, and resumes execution seamlessly.

### 3. Network Transport
*   **Proxying**: In development, the browser sends the request to `http://localhost:3000/api/analyze`.
*   **Vite Server**: The Vite development server sees the `/api` prefix and proxies the request to the backend at `http://localhost:3001/api/v1/analyze`, rewriting the origin header to match.

### 4. Backend Processing (NestJS)
*   **Route Handling**: The request hits the `AnalysisController` in `backend/src/modules/analysis`.
*   **Guards**: The `JwtAuthGuard` intercepts the request, validates the token signature, and attaches the `user` object to the request context.
*   **Validation**: NestJS `ValidationPipe` ensures the request body matches the expected DTO (Data Transfer Object).

### 5. Service Logic
*   **AnalysisService**: The controller delegates to `AnalysisService`.
*   **Parsing**: The service uses regex/parsing logic to convert the extensive text logs into a structured DAG object.
*   **AI Reasoning**: The service constructs a prompt with system instructions and sends it to `Google Gemini 2.0 Flash` via the `GeminiService`.
*   **Persistence**: (Optional) The result is saved to the user's history using `PrismaService`.

### 6. Response
*   The backend returns a standard JSON response:
    ```json
    {
      "success": true,
      "data": { ...analysisResult }
    }
    ```
*   The frontend receives the data, updates the React state, and D3.js renders the optimized graph.

## Core Backend Modules

1.  **Analysis Module**:
    *   **Controller**: `AnalysisController`
    *   **Service**: `AnalysisService`
    *   **Responsibility**: Parsing logs, generating optimization tips, and interacting with the LLM.

2.  **Chat Module**:
    *   **Controller**: `ChatController`
    *   **Service**: `ChatService`
    *   **Responsibility**: Manages chat history and context for the AI consultant feature.

3.  **Auth Module**:
    *   **Controller**: `AuthController`
    *   **Service**: `AuthService`
    *   **Responsibility**: Handles Login, Registration, JWT generation, and Refresh Tokens.
