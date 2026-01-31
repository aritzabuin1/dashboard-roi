-- Migration: Add auth_user_id to clients table
-- Run this in Supabase SQL Editor

-- Add column to link clients to Supabase Auth users
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);

-- Update RLS policy for clients to only see their own data
DROP POLICY IF EXISTS "Clients can view own data" ON public.clients;

CREATE POLICY "Clients can view own data"
ON public.clients FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid() OR auth_user_id IS NULL);

-- Allow clients to view their own automations
DROP POLICY IF EXISTS "Clients can view own automations" ON public.automation_metadata;

CREATE POLICY "Clients can view own automations"
ON public.automation_metadata FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.clients WHERE auth_user_id IS NULL
  )
);

-- Allow clients to view their own executions
DROP POLICY IF EXISTS "Clients can view own executions" ON public.executions;

CREATE POLICY "Clients can view own executions"
ON public.executions FOR SELECT
TO authenticated
USING (
  automation_id IN (
    SELECT am.id FROM public.automation_metadata am
    JOIN public.clients c ON am.client_id = c.id
    WHERE c.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.clients WHERE auth_user_id IS NULL
  )
);
