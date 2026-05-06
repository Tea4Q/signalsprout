-- Migration: Create credit_purchases table for tracking AI/tool credit top-ups

CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor          text NOT NULL,            -- e.g. "Runway", "OpenAI", "Anthropic"
  amount_usd      numeric(10, 4) NOT NULL CHECK (amount_usd > 0),
  credits         numeric(14, 4) NOT NULL CHECK (credits > 0),
  purchased_at    date NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_purchases_select"
  ON public.credit_purchases FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "credit_purchases_insert"
  ON public.credit_purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "credit_purchases_delete"
  ON public.credit_purchases FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX credit_purchases_workspace_idx ON public.credit_purchases (workspace_id);
CREATE INDEX credit_purchases_vendor_idx    ON public.credit_purchases (workspace_id, vendor);
