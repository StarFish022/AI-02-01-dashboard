CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at_utc TEXT NOT NULL,
  finished_at_utc TEXT,
  status TEXT NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS youtube_snapshots (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  snapshot_at_utc TEXT NOT NULL,
  snapshot_date_msk TEXT NOT NULL,
  view_count INTEGER NOT NULL,
  subscriber_count INTEGER NOT NULL,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_youtube_snapshots_date
ON youtube_snapshots (snapshot_date_msk);

CREATE TABLE IF NOT EXISTS sales_rows_raw (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  row_index INTEGER,
  sale_date_msk TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  record_hash TEXT NOT NULL UNIQUE,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_rows_date
ON sales_rows_raw (sale_date_msk);

CREATE INDEX IF NOT EXISTS idx_sales_rows_product
ON sales_rows_raw (product_name);

CREATE TABLE IF NOT EXISTS telegram_posts (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  message_id INTEGER NOT NULL,
  message_date_utc TEXT NOT NULL,
  message_date_msk TEXT NOT NULL,
  title TEXT,
  excerpt TEXT,
  content TEXT,
  permalink TEXT,
  raw_json TEXT,
  UNIQUE(channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_posts_date
ON telegram_posts (message_date_utc DESC);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
