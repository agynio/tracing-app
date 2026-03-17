# Tracing App

Single-page application for visualizing agent run traces, LLM context, tool output, and run summaries. Built with React + Vite and designed to connect to the tracing platform API.

## Prerequisites

- Node.js (LTS recommended)
- pnpm

## Setup

Install dependencies:

```bash
pnpm install
```

Run the dev server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## Environment Variables

- `VITE_API_BASE_URL` (required): Base URL for the tracing API and socket connections.
  - Example: `https://platform.example.com/api`
  - For local dev using the mock API, set `VITE_API_BASE_URL=/api`

## Architecture Overview

- **API layer**: `src/api` contains typed clients and hooks for run summaries, timeline events, and context pages.
- **UI layer**: `src/components` renders the run timeline, event details, and tool output panes.
- **Screens**: `src/pages` composes API data with UI components (e.g., `AgentsRunScreen`).
- **Real-time updates**: `src/lib/graph/socket.ts` maintains socket listeners for run status and timeline events.
