ALTER TABLE automation_metadata
  ADD COLUMN IF NOT EXISTS expected_frequency text NOT NULL DEFAULT 'on_demand'
  CHECK (expected_frequency IN ('daily', 'weekly', 'on_demand', 'custom'));

ALTER TABLE automation_metadata
  ADD COLUMN IF NOT EXISTS silence_threshold_hours integer DEFAULT NULL;

CREATE TABLE IF NOT EXISTS silence_alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  automation_id uuid NOT NULL REFERENCES automation_metadata(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_execution_at timestamptz,
  threshold_hours integer NOT NULL,
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_silence_alerts_unresolved
  ON silence_alerts(resolved) WHERE resolved = false;

ALTER TABLE silence_alerts ENABLE ROW LEVEL SECURITY;
