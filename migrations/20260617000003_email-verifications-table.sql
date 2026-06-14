-- Temporary storage for pre-registration OTP codes.
-- Records are deleted immediately on successful verification.
-- No RLS policies = zero public access (only server API routes via service key).

CREATE TABLE public.email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_verifications_email_idx
  ON public.email_verifications(email);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
-- No policies = deny all non-service-key access
