-- =============================================================
-- Migration 041: Notifications System
-- Purpose: Track real-time alerts for invoices, messages, etc.
-- =============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
          'invoice_new', 
          'invoice_accepted', 
          'invoice_paid', 
          'invoice_payment_claimed',
          'contact_request', 
          'message_new'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id), -- Specific user or all business members if null
  type            public.notification_type NOT NULL,
  title           text        NOT NULL,
  message         text        NOT NULL,
  link            text,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_business_read ON public.notifications(business_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Members can see notifications for their business
CREATE POLICY "Users can view notifications for their business"
ON public.notifications FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid() AND status = 'active'
  )
  OR (user_id = auth.uid())
);

-- Policy: Members can mark their business notifications as read
CREATE POLICY "Users can update their business notifications"
ON public.notifications FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid() AND status = 'active'
  )
  OR (user_id = auth.uid())
);

-- Helper function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_business_id   uuid,
  p_user_id       uuid,
  p_type          public.notification_type,
  p_title         text,
  p_message       text,
  p_link          text default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (business_id, user_id, type, title, message, link)
  VALUES (p_business_id, p_user_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
