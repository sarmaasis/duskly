-- Space name + who they are, and a one-time onboarding flag
ALTER TABLE workspace ADD COLUMN account_kind text;
ALTER TABLE workspace ADD COLUMN onboarding_completed integer NOT NULL DEFAULT 0;
