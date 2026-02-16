CREATE TABLE IF NOT EXISTS calendar_events_upcoming (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  event_id TEXT NOT NULL,
  calendar_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  start_time_utc TEXT NOT NULL,
  end_time_utc TEXT,
  html_link TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start
ON calendar_events_upcoming (start_time_utc);

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_events_event_start
ON calendar_events_upcoming (event_id, start_time_utc);
