-- ============================================================
-- SelfOS — Initial Schema
-- Run this in the Supabase SQL Editor (once, in order)
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Notebooks ─────────────────────────────────────────────────
CREATE TABLE notebooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  area        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notebooks: solo proprietario"
  ON notebooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Notes ─────────────────────────────────────────────────────
CREATE TABLE notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id  UUID REFERENCES notebooks(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT '',
  content      JSONB NOT NULL DEFAULT '{}',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes: solo proprietario"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Full-text search index on title
CREATE INDEX notes_title_fts ON notes USING GIN (to_tsvector('italian', title));

-- ── Accounts ──────────────────────────────────────────────────
CREATE TABLE accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'investment', 'other')),
  currency    TEXT NOT NULL DEFAULT 'EUR',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts: solo proprietario"
  ON accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Balance Snapshots ─────────────────────────────────────────
CREATE TABLE balance_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance         NUMERIC(15, 2) NOT NULL,
  snapshot_month  CHAR(7) NOT NULL, -- Format: YYYY-MM
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_month)
);

ALTER TABLE balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_snapshots: solo proprietario"
  ON balance_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Recurring Expenses ────────────────────────────────────────
CREATE TABLE recurring_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  amount         NUMERIC(12, 2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'EUR',
  frequency      TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  category       TEXT NOT NULL,
  next_due_date  DATE NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_expenses: solo proprietario"
  ON recurring_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Financial Commitments ─────────────────────────────────────
CREATE TABLE financial_commitments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('mortgage', 'loan', 'lease', 'other')),
  original_amount   NUMERIC(15, 2) NOT NULL,
  remaining_amount  NUMERIC(15, 2) NOT NULL,
  monthly_payment   NUMERIC(10, 2) NOT NULL,
  interest_rate     NUMERIC(5, 3),
  end_date          DATE,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_commitments: solo proprietario"
  ON financial_commitments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_commitments_updated_at
  BEFORE UPDATE ON financial_commitments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
