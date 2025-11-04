-- === Core Events Table ===
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_id TEXT NOT NULL,
    source_system TEXT NOT NULL,
    signature TEXT,
    raw_body JSONB NOT NULL,
    dedup_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    transformed_body JSONB,
    destinations JSONB DEFAULT '[]'::jsonb
);

-- Unique constraint for idempotency (no duplicate events)
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_dedup 
ON public.events (client_id, source_system, dedup_key);

-- === Event Deliveries (per destination) ===
CREATE TABLE IF NOT EXISTS public.event_deliveries (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES public.events(id) ON DELETE CASCADE,
    destination_type TEXT NOT NULL, -- 'http' or 'postgres'
    destination TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS' or 'FAILED'
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, destination_type, destination)
);
