-- Orbit: infrastructuur die Prisma zelf niet kan uitdrukken.
-- Idempotent: dit bestand mag zo vaak draaien als nodig.
--
-- Draai dit na `prisma migrate deploy`:
--   npm run db:setup --workspace @orbit/db

-- ---------------------------------------------------------------------------
-- 1. Logische klok voor delta-sync
-- ---------------------------------------------------------------------------
-- Eén globale sequence in plaats van één per workspace: sequences zijn DDL, en
-- DDL per gebruiker schaalt niet. De cursors van een client maken sprongen
-- doordat andere workspaces ertussen zitten, maar de volgorde binnen een
-- workspace blijft strikt monotoon, en dat is het enige wat de sync nodig heeft.

CREATE SEQUENCE IF NOT EXISTS orbit_server_seq AS bigint START WITH 1;

-- Een trigger in plaats van applicatiecode: zo kan geen enkel codepad, ook geen
-- toekomstig script of handmatige UPDATE, vergeten de klok bij te werken.
CREATE OR REPLACE FUNCTION orbit_bump_server_seq() RETURNS trigger AS $$
BEGIN
  NEW.server_seq := nextval('orbit_server_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target text;
BEGIN
  -- De detailtabellen (task_details, note_details, idea_details) staan hier
  -- bewust niet bij: die hebben geen eigen klok maar erven die van hun item.
  FOREACH target IN ARRAY ARRAY[
    'items', 'checklist_items', 'projects', 'tags', 'item_tags', 'reminders',
    'attachments', 'item_links', 'note_folders'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || target || '_seq', target);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION orbit_bump_server_seq()',
      'trg_' || target || '_seq', target
    );
  END LOOP;
END;
$$;

-- Een wijziging in een detailtabel moet het bovenliggende item ook nieuw maken
-- voor de sync, anders mist een client een gewijzigde deadline.
CREATE OR REPLACE FUNCTION orbit_touch_parent_item() RETURNS trigger AS $$
DECLARE
  target_id char(26);
BEGIN
  target_id := COALESCE(NEW.item_id, OLD.item_id);
  UPDATE items SET updated_at = now() WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['task_details', 'note_details', 'idea_details']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || target || '_touch', target);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION orbit_touch_parent_item()',
      'trg_' || target || '_touch', target
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Full-text search
-- ---------------------------------------------------------------------------
-- 'simple' in plaats van 'dutch': de app is meertalig en stemming op de
-- verkeerde taal levert slechtere resultaten dan geen stemming. Titels wegen
-- zwaarder (A) dan de preview (B).

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(preview, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS items_search_idx ON items USING GIN (search_vector);

ALTER TABLE note_details
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(plain_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS note_details_search_idx ON note_details USING GIN (search_vector);

-- Trigram-index voor "bevat"-zoeken en typefouten, als aanvulling op FTS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS items_title_trgm_idx ON items USING GIN (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Partiële indexen voor de views
-- ---------------------------------------------------------------------------
-- Partieel op `deleted_at IS NULL`: tombstones blijven staan, maar de dagelijkse
-- queries hoeven ze niet te doorlopen.

CREATE INDEX IF NOT EXISTS items_active_idx
  ON items (workspace_id, type, sort_key)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS task_details_due_idx
  ON task_details (workspace_id, due_date, status)
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS reminders_pending_idx
  ON reminders (remind_at)
  WHERE status = 'SCHEDULED' AND deleted_at IS NULL;

-- E-mailadressen worden in de applicatie genormaliseerd naar kleine letters;
-- deze unieke index maakt dat een harde garantie.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
