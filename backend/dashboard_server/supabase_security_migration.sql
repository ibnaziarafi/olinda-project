-- REVIEW BEFORE RUNNING. Existing data is retained; public API access is revoked.
-- Both APIs must use SERVER-ONLY service_role credentials, never anon keys.
BEGIN;
-- Shared counters use the existing Supabase project; no Redis service is needed.
CREATE TABLE IF NOT EXISTS public.api_usage_counters (
    bucket_key TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS api_usage_expiry_idx ON public.api_usage_counters(expires_at);
ALTER TABLE public.api_usage_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_usage_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_usage_counters TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_quota(
    p_bucket_key TEXT, p_request_limit INTEGER, p_expires_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE accepted BOOLEAN;
BEGIN
    IF length(p_bucket_key) > 128 OR p_request_limit < 1 OR p_request_limit > 100000
        OR p_expires_at <= now() OR p_expires_at > now() + INTERVAL '2 days 5 minutes' THEN
        RAISE EXCEPTION 'Invalid quota settings';
    END IF;
    DELETE FROM public.api_usage_counters WHERE expires_at < now();
    INSERT INTO public.api_usage_counters AS counters (bucket_key, request_count, expires_at)
        VALUES (p_bucket_key, 1, p_expires_at)
    ON CONFLICT (bucket_key) DO UPDATE
        SET request_count = counters.request_count + 1
        WHERE counters.request_count < p_request_limit
    RETURNING TRUE INTO accepted;
    RETURN COALESCE(accepted, FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_quota(TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(TEXT, INTEGER, TIMESTAMPTZ) TO service_role;

ALTER TABLE public.course_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unanswered_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.course_chunks, public.sessions, public.messages,
    public.unanswered_log, public.staff_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_chunks(vector, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, double precision, integer) TO service_role;
ALTER FUNCTION public.match_chunks(vector, double precision, integer) SET search_path = public, pg_temp;
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS unanswered_occurred_at_idx ON public.unanswered_log(occurred_at);
COMMIT;
NOTIFY pgrst, 'reload schema';
