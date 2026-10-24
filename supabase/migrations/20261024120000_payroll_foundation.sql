-- =============================================================================
-- Payroll foundation: employee daily rates + Philippine holiday calendar
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once (idempotent).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Daily rate per employee (₱). Edited by admins in Add/Edit Employee.
--    Null = no rate set yet (employee shows "No rate" in Payroll).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_rate numeric(10, 2);

COMMENT ON COLUMN public.profiles.daily_rate IS
  '₱ per regular working day. Hourly rate = daily_rate / 8.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Holiday calendar driving PH holiday pay premiums:
--      regular → 200% if worked, 100% if unworked (paid when worked day before)
--      special → 130% if worked, no pay if unworked
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date NOT NULL UNIQUE,
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'regular'
             CHECK (kind IN ('regular', 'special')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.holidays IS
  'Philippine non-working holidays. kind=regular (200% worked / 100% unworked) '
  'or kind=special (130% worked / no pay unworked).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Row Level SECURITY — admins only.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read holidays" ON public.holidays;
CREATE POLICY "Admins read holidays" ON public.holidays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins insert holidays" ON public.holidays;
CREATE POLICY "Admins insert holidays" ON public.holidays
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins update holidays" ON public.holidays;
CREATE POLICY "Admins update holidays" ON public.holidays
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins delete holidays" ON public.holidays;
CREATE POLICY "Admins delete holidays" ON public.holidays
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed holidays — full 2026 + fixed/derivable 2027 dates.
--    Eid dates and any dates moved by presidential proclamation can be added
--    or corrected from Payroll → Holidays in the admin panel.
--    ON CONFLICT DO NOTHING keeps this safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.holidays (date, name, kind) VALUES
  -- 2026 — Regular holidays
  ('2026-01-01', 'New Year''s Day', 'regular'),
  ('2026-04-02', 'Maundy Thursday', 'regular'),
  ('2026-04-03', 'Good Friday', 'regular'),
  ('2026-04-09', 'Day of Valor (Araw ng Kagitingan)', 'regular'),
  ('2026-05-01', 'Labor Day', 'regular'),
  ('2026-06-12', 'Independence Day', 'regular'),
  ('2026-08-31', 'National Heroes Day', 'regular'),
  ('2026-11-30', 'Bonifacio Day', 'regular'),
  ('2026-12-25', 'Christmas Day', 'regular'),
  ('2026-12-30', 'Rizal Day', 'regular'),
  -- 2026 — Special non-working days
  ('2026-02-17', 'Chinese New Year', 'special'),
  ('2026-04-04', 'Black Saturday', 'special'),
  ('2026-08-21', 'Ninoy Aquino Day', 'special'),
  ('2026-11-01', 'All Saints'' Day', 'special'),
  ('2026-11-02', 'All Souls'' Day', 'special'),
  ('2026-12-08', 'Feast of the Immaculate Conception', 'special'),
  ('2026-12-24', 'Christmas Eve', 'special'),
  ('2026-12-31', 'New Year''s Eve', 'special'),

  -- 2027 — Regular holidays (fixed + derived from Easter 2027 = Mar 28)
  ('2027-01-01', 'New Year''s Day', 'regular'),
  ('2027-03-25', 'Maundy Thursday', 'regular'),
  ('2027-03-26', 'Good Friday', 'regular'),
  ('2027-04-09', 'Day of Valor (Araw ng Kagitingan)', 'regular'),
  ('2027-05-01', 'Labor Day', 'regular'),
  ('2027-06-12', 'Independence Day', 'regular'),
  ('2027-08-30', 'National Heroes Day', 'regular'),
  ('2027-11-30', 'Bonifacio Day', 'regular'),
  ('2027-12-25', 'Christmas Day', 'regular'),
  ('2027-12-30', 'Rizal Day', 'regular'),
  -- 2027 — Special non-working days
  ('2027-02-06', 'Chinese New Year', 'special'),
  ('2027-03-27', 'Black Saturday', 'special'),
  ('2027-08-21', 'Ninoy Aquino Day', 'special'),
  ('2027-11-01', 'All Saints'' Day', 'special'),
  ('2027-11-02', 'All Souls'' Day', 'special'),
  ('2027-12-08', 'Feast of the Immaculate Conception', 'special'),
  ('2027-12-24', 'Christmas Eve', 'special'),
  ('2027-12-31', 'New Year''s Eve', 'special')
ON CONFLICT (date) DO NOTHING;
