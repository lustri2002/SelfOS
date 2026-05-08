-- Track the latest month automatically applied for installment commitments.
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS last_auto_paid_month CHAR(7) DEFAULT NULL;
