# Directive: Database Setup (Supabase)

## Goal
Define and apply the SQL schema for tracking automation executions and calculating ROI.

## Inputs
- **Supabase Project**: (User will provide credentials later, for now we define the SQL).
- **Tables**: `clients`, `automation_metadata`, `executions`.

## Steps

1.  **Create SQL Definition File**
    Create `execution/schema.sql` with the following content:

    ```sql
    -- Enable UUID extension
    create extension if not exists "uuid-ossp";

    -- 1. Clients Table
    create table public.clients (
      id uuid default uuid_generate_v4() primary key,
      created_at timestamptz default now(),
      name text not null,
      api_key text not null unique, -- Simple API Key for authentication
      currency text default 'EUR'
    );

    -- 2. Automation Metadata (ROI configuration)
    create table public.automation_metadata (
      id uuid default uuid_generate_v4() primary key,
      created_at timestamptz default now(),
      client_id uuid references public.clients(id) on delete cascade not null,
      name text not null,
      manual_duration_minutes numeric not null, -- How long a human takes (minutes)
      cost_per_hour numeric not null, -- Hourly rate (EUR)
      unique(client_id, name)
    );

    -- 3. Executions (Logs)
    create table public.executions (
      id uuid default uuid_generate_v4() primary key,
      created_at timestamptz default now(),
      automation_id uuid references public.automation_metadata(id) on delete cascade not null,
      status text check (status in ('success', 'error')) not null,
      execution_timestamp timestamptz default now()
    );
    
    -- Indexes for performance
    create index idx_executions_automation_id on public.executions(automation_id);
    create index idx_executions_timestamp on public.executions(execution_timestamp);
    ```

2.  **Verify Schema**
    - Ensure foreign keys and constraints are correct.
    - `manual_duration_minutes` allows precise calculations (e.g., 0.5 mins).

## Outputs
- `execution/schema.sql` file ready to be run in Supabase Query Editor.
