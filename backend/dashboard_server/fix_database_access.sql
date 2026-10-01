-- Review in the correct Supabase project before running in its SQL Editor.
-- Prerequisite: BOTH backends now use private service_role/secret credentials.
-- Restricts direct public database access; preserves all existing data.
-- This does not add encryption or change chatbot/student login behavior.
BEGIN;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unanswered_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_users, public.course_chunks, public.sessions,
    public.messages, public.unanswered_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_users,
    public.course_chunks, public.sessions, public.messages,
    public.unanswered_log TO service_role;

-- Resolve actual function signatures from PostgreSQL, including any overloads.
-- The fixed path supports vector in its current public schema, or extensions
-- after a separately reviewed relocation. Do not move the extension here.
DO $$
DECLARE target RECORD;
BEGIN
    FOR target IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc AS p
        JOIN pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'match_chunks'
          AND p.prokind = 'f'
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', target.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target.signature);
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', target.signature);
    END LOOP;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Read-only confirmation: all five rows should have rls_enabled = true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('staff_users', 'course_chunks', 'sessions', 'messages', 'unanswered_log')
ORDER BY c.relname;
