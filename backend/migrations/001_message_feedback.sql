-- Apply once to the deployed Supabase database before deploying feedback.
CREATE TABLE IF NOT EXISTS public.message_feedback (
    message_id UUID PRIMARY KEY REFERENCES public.messages(message_id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
-- Access is through the backend service-role key only; no browser policy.
