-- RLS Policies V2 (Secure Data Isolation)

-- 1. Enable RLS on all tables (idempotent)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

-- 2. Drop insecure "allow all" policies
DROP POLICY IF EXISTS "Allow public read on executions" ON executions;
DROP POLICY IF EXISTS "Allow public read on automation_metadata" ON automation_metadata;
DROP POLICY IF EXISTS "Allow public read on clients" ON clients;
DROP POLICY IF EXISTS "Allow insert on executions" ON executions;
DROP POLICY IF EXISTS "Allow insert on automation_metadata" ON automation_metadata;
DROP POLICY IF EXISTS "Allow insert on clients" ON clients;

-- 3. CLIENTS TABLE POLICIES
-- Authenticated users (clients) can only see THEIR OWN profile
CREATE POLICY "Users see own client profile"
ON clients FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Admins (via Service Role) have full access (Bypasses RLS automatically, but good to be explicit if using an admin role)
-- Note: Service Role key bypasses RLS, so we don't strictly need a policy for it, but we MUST ensure APIs use it.


-- 4. AUTOMATION_METADATA POLICIES
-- Users see automations linked to their client ID
CREATE POLICY "Users see own automations"
ON automation_metadata FOR SELECT
TO authenticated
USING (client_id IN (
    SELECT id FROM clients WHERE auth_user_id = auth.uid()
));


-- 5. EXECUTIONS POLICIES
-- Users see executions linked to their automations
CREATE POLICY "Users see own executions"
ON executions FOR SELECT
TO authenticated
USING (automation_id IN (
    SELECT id FROM automation_metadata
    WHERE client_id IN (
        SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
));

-- 6. WEBHOOK INSERTS
-- The webhook uses SERVICE_ROLE_KEY, which bypasses RLS.
-- So we DO NOT create an INSERT policy for 'anon' or 'authenticated'.
-- This effectively blocks any anon user from inserting fake executions.
