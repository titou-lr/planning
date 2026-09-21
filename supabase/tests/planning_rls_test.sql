BEGIN;
SELECT plan(10);

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
SELECT results_eq(
  $$SELECT public FROM storage.buckets WHERE id = 'planning-attachments'$$,
  ARRAY[false],
  'le bucket des pièces jointes est privé'
);
SELECT results_eq(
  $$SELECT count(*)::bigint FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'planning_attachments_%'$$,
  ARRAY[3::bigint],
  'les objets Storage sont protégés par les politiques propriétaire'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT results_eq(
  'SELECT id FROM public.pages ORDER BY id',
  ARRAY['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid],
  'le propriétaire voit ses pages'
);

INSERT INTO public.sync_mutations (
  mutation_id, workspace_id, device_id, entity_type, entity_id, operation, payload
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'page', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'upsert', '{"title":"test"}'
);
SELECT results_eq(
  'SELECT count(*)::bigint FROM public.sync_mutations',
  ARRAY[1::bigint],
  'le propriétaire peut ajouter une mutation'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.sync_mutations', 'UPDATE'),
  'le journal est append-only pour le client'
);

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT is_empty(
  'SELECT id FROM public.pages',
  'un autre utilisateur ne voit aucune page'
);
SELECT is_empty(
  'SELECT mutation_id FROM public.sync_mutations',
  'un autre utilisateur ne voit aucune mutation'
);

SELECT * FROM finish();
ROLLBACK;
