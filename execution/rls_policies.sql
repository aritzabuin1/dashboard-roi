-- Supabase Row Level Security (RLS) Policies
-- Run this in the Supabase SQL Editor after the initial schema

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read on executions (for dashboard)
-- The anon key can read executions for display purposes
CREATE POLICY "Allow public read on executions"
ON executions FOR SELECT
TO anon
USING (true);

-- Policy: Allow public read on automation_metadata (for dashboard)
CREATE POLICY "Allow public read on automation_metadata"
ON automation_metadata FOR SELECT
TO anon
USING (true);

-- Policy: Allow public read on clients (for dashboard client filter)
-- Only exposing id and name, not api_key (controlled at query level)
CREATE POLICY "Allow public read on clients"
ON clients FOR SELECT
TO anon
USING (true);

-- Policy: Allow insert on executions (for webhook)
CREATE POLICY "Allow insert on executions"
ON executions FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow insert on automation_metadata (for webhook auto-create)
CREATE POLICY "Allow insert on automation_metadata"
ON automation_metadata FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow insert on clients (for admin panel)
CREATE POLICY "Allow insert on clients"
ON clients FOR INSERT
TO anon
WITH CHECK (true);

-- NOTE: For production, you should:
-- 1. Use authenticated roles instead of anon
-- 2. Restrict SELECT on clients to only return id, name (not api_key) 
-- 3. Use a service_role key for server-side operations
-- 4. Add UPDATE/DELETE policies as needed
