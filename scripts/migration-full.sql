-- ============================================
-- FULL MIGRATION: Dashboard → New Supabase Project
-- Run this in: Supabase SQL Editor (single execution)
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables
CREATE TABLE public.clients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  api_key text NOT NULL UNIQUE,
  currency text DEFAULT 'EUR',
  auth_user_id uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_clients_auth_user_id ON public.clients(auth_user_id);

CREATE TABLE public.automation_metadata (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  manual_duration_minutes numeric NOT NULL,
  cost_per_hour numeric NOT NULL,
  UNIQUE(client_id, name)
);

CREATE TABLE public.executions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  automation_id uuid REFERENCES public.automation_metadata(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('success', 'error')) NOT NULL,
  execution_timestamp timestamptz DEFAULT now()
);

CREATE INDEX idx_executions_automation_id ON public.executions(automation_id);
CREATE INDEX idx_executions_timestamp ON public.executions(execution_timestamp);

-- Multi-user access per client
CREATE TABLE public.client_users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'viewer',
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(client_id, email)
);

CREATE INDEX idx_client_users_client_id ON public.client_users(client_id);
CREATE INDEX idx_client_users_auth_user_id ON public.client_users(auth_user_id);

-- 3. Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- client_users: users see own memberships
CREATE POLICY "Users see own memberships"
ON public.client_users FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- clients: users see profile if primary auth_user OR in client_users
CREATE POLICY "Users see own client profile"
ON public.clients FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_user_id
  OR id IN (SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid())
);

-- automation_metadata: users see automations linked via clients or client_users
CREATE POLICY "Users see own automations"
ON public.automation_metadata FOR SELECT
TO authenticated
USING (client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    UNION
    SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid()
));

-- executions: users see executions from accessible automations
CREATE POLICY "Users see own executions"
ON public.executions FOR SELECT
TO authenticated
USING (automation_id IN (
    SELECT id FROM public.automation_metadata
    WHERE client_id IN (
        SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
        UNION
        SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid()
    )
));
