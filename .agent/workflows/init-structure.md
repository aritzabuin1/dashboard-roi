---
description: Initialize a new project with the 3-Layer Architecture (Directives, Execution, Agent)
---

# Project Initialization Workflow

Run this workflow at the very beginning of a new project to set up the standard directory structure and core files.

## Steps

### 1. Create Directory Structure
- Create the following folders in the root:
  - `directives/` (For user SOPs and instructions)
  - `execution/` (For deterministic Python/Node scripts)
  - `.tmp/` (For intermediate files - ensure this is gitignored)
  - `.agent/workflows/` (For agent automation scripts like this one)

### 2. Set Up Git Ignore
- Create or update `.gitignore` to include:
  ```
  node_modules/
  .env
  .tmp/
  __pycache__/
  .DS_Store
  ```

### 3. Create Security Foundation
- Create `.env.example` with standard keys:
  ```
  # App
  NODE_ENV=development
  PORT=3000

  # Supabase (if used)
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=

  # Security
  JWT_SECRET=
  ADMIN_PASSWORD=
  ```
- **Action**: Warn user to NEVER commit real `.env` files.

### 4. Internalize GEMINI.md (System OS)
- **CRITICAL**: The user will provide a `GEMINI.md` file in the root.
- **Action**: Read this file immediately using `view_file`.
- **Purpose**: Understand the 3-Layer Architecture and Operating Principles.
- Confirm you have internalized:
  - The separation of Directives, Orchestration, and Execution.
  - The "Self-annealing" principle.

### 5. Finalize
- Run `npm init -y` (if Node.js) or `pip freeze > requirements.txt` (if Python).
- Initialize git: `git init`.
- Create an initial `README.md` with:
  - Project Title
  - "Architecture: Agentic 3-Layer (Directives/Execution/Agent)"
