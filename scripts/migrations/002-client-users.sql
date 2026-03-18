-- Migration: Multi-user access per client
-- Run this in: Supabase SQL Editor

-- 1. New table: client_users (multiple users per client)
CREATE TABLE public.client_users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'viewer',  -- label: "CEO", "CTO", "viewer", etc.
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(client_id, email)
);

CREATE INDEX idx_client_users_client_id ON public.client_users(client_id);
CREATE INDEX idx_client_users_auth_user_id ON public.client_users(auth_user_id);

-- 2. Enable RLS on client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own membership
CREATE POLICY "Users see own memberships"
ON public.client_users FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- 3. Update RLS policies to include client_users
-- Drop existing policies first
DROP POLICY IF EXISTS "Users see own client profile" ON public.clients;
DROP POLICY IF EXISTS "Users see own automations" ON public.automation_metadata;
DROP POLICY IF EXISTS "Users see own executions" ON public.executions;

-- Clients: user sees profile if they are the primary auth_user OR in client_users
CREATE POLICY "Users see own client profile"
ON public.clients FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_user_id
  OR id IN (SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid())
);

-- Automations: user sees automations if linked via clients or client_users
CREATE POLICY "Users see own automations"
ON public.automation_metadata FOR SELECT
TO authenticated
USING (client_id IN (
  SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  UNION
  SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid()
));

-- Executions: user sees executions if linked via automations they can access
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
