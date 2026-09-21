BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner@example.test', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@example.test', now(), now());

INSERT INTO public.workspaces (id, owner_id, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Owner workspace');
INSERT INTO public.pages (id, workspace_id, title)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner page');

SELECT has_table('public', 'workspaces', 'workspaces existe');
SELECT has_table('public', 'pages', 'pages existe');
SELECT results_eq(
  $$SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pages'::regclass$$,
  ARRAY[true],
  'RLS est activée sur pages'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT results_eq(
  'SELECT id FROM public.pages ORDER BY id',
  ARRAY['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid],
  'le propriétaire voit ses pages'
);

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT is_empty(
  'SELECT id FROM public.pages',
  'un autre utilisateur ne voit aucune page'
);

SELECT * FROM finish();
ROLLBACK;
