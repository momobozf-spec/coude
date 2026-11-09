-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('TASK', 'NOTE', 'IDEA');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('NEW', 'EXPLORING', 'INTERESTING', 'LATER', 'DEVELOPING', 'CONVERTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('MANUAL', 'QUICK', 'NLP', 'IMPORT', 'AI');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('PUSH', 'LOCAL', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'DISMISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "LinkKind" AS ENUM ('RELATED', 'BLOCKS', 'DERIVED_FROM', 'MENTIONS');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RESTORED', 'COMPLETED', 'REOPENED', 'CONVERTED', 'ARCHIVED', 'MOVED', 'CONFLICT_RESOLVED', 'LOGGED_IN', 'LOGGED_OUT', 'EXPORTED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ITEM', 'PROJECT', 'TAG', 'REMINDER', 'ATTACHMENT', 'CHECKLIST_ITEM', 'NOTE_FOLDER', 'USER', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(26) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255),
    "name" VARCHAR(120) NOT NULL,
    "avatar_url" VARCHAR(2048),
    "locale" VARCHAR(10) NOT NULL DEFAULT 'nl',
    "time_zone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Brussels',
    "email_verified_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(254),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "parent_id" CHAR(26),
    "device_id" CHAR(26),
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" VARCHAR(120) NOT NULL DEFAULT '',
    "push_token" VARCHAR(500),
    "last_sync_seq" BIGINT NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" CHAR(26) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "owner_id" CHAR(26) NOT NULL,
    "personal" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "workspace_id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'OWNER',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(9) NOT NULL DEFAULT '#4f46e5',
    "icon" VARCHAR(32),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "start_date" DATE,
    "end_date" DATE,
    "sort_key" VARCHAR(200) NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "type" "ItemType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "preview" VARCHAR(500) NOT NULL DEFAULT '',
    "project_id" CHAR(26),
    "in_inbox" BOOLEAN NOT NULL DEFAULT true,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(3),
    "sort_key" VARCHAR(200) NOT NULL,
    "captured_via" "CaptureSource" NOT NULL DEFAULT 'MANUAL',
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_details" (
    "item_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "due_date" DATE,
    "due_time" VARCHAR(5),
    "start_date" DATE,
    "completed_at" TIMESTAMPTZ(3),
    "estimate_minutes" INTEGER,
    "recurrence" JSONB,
    "recurrence_parent_id" CHAR(26),
    "parent_task_id" CHAR(26),

    CONSTRAINT "task_details_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "note_details" (
    "item_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "content" JSONB NOT NULL DEFAULT '[]',
    "plain_text" TEXT NOT NULL DEFAULT '',
    "folder_id" CHAR(26),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "last_edited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_details_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "idea_details" (
    "item_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(80),
    "status" "IdeaStatus" NOT NULL DEFAULT 'NEW',
    "impact" INTEGER,
    "effort" INTEGER,
    "converted_to_project_id" CHAR(26),
    "source_url" VARCHAR(2048),

    CONSTRAINT "idea_details_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "item_id" CHAR(26) NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMPTZ(3),
    "sort_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#64748b',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_tags" (
    "item_id" CHAR(26) NOT NULL,
    "tag_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "item_tags_pkey" PRIMARY KEY ("item_id","tag_id")
);

-- CreateTable
CREATE TABLE "note_folders" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "parent_id" CHAR(26),
    "icon" VARCHAR(32),
    "color" VARCHAR(9),
    "sort_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "note_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "item_id" CHAR(26) NOT NULL,
    "remind_at" TIMESTAMPTZ(3) NOT NULL,
    "offset_minutes" INTEGER,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'PUSH',
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "item_id" CHAR(26) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploaded_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_links" (
    "from_item_id" CHAR(26) NOT NULL,
    "to_item_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "kind" "LinkKind" NOT NULL DEFAULT 'RELATED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    "server_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "item_links_pkey" PRIMARY KEY ("from_item_id","to_item_id","kind")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "actor_id" CHAR(26),
    "entity_type" "EntityType" NOT NULL,
    "entity_id" CHAR(26) NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "operation_id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "device_id" CHAR(26) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_id" CHAR(26) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("operation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_account_id_key" ON "auth_identities"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "devices_push_token_idx" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_server_seq_idx" ON "projects"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "projects_workspace_id_status_sort_key_idx" ON "projects"("workspace_id", "status", "sort_key");

-- CreateIndex
CREATE INDEX "projects_workspace_id_favorite_idx" ON "projects"("workspace_id", "favorite");

-- CreateIndex
CREATE INDEX "items_workspace_id_server_seq_idx" ON "items"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "items_workspace_id_type_deleted_at_idx" ON "items"("workspace_id", "type", "deleted_at");

-- CreateIndex
CREATE INDEX "items_workspace_id_in_inbox_created_at_idx" ON "items"("workspace_id", "in_inbox", "created_at" DESC);

-- CreateIndex
CREATE INDEX "items_workspace_id_project_id_type_sort_key_idx" ON "items"("workspace_id", "project_id", "type", "sort_key");

-- CreateIndex
CREATE INDEX "items_workspace_id_favorite_updated_at_idx" ON "items"("workspace_id", "favorite", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "items_workspace_id_updated_at_idx" ON "items"("workspace_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "task_details_workspace_id_status_due_date_idx" ON "task_details"("workspace_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "task_details_workspace_id_priority_due_date_idx" ON "task_details"("workspace_id", "priority", "due_date");

-- CreateIndex
CREATE INDEX "task_details_parent_task_id_idx" ON "task_details"("parent_task_id");

-- CreateIndex
CREATE INDEX "task_details_recurrence_parent_id_idx" ON "task_details"("recurrence_parent_id");

-- CreateIndex
CREATE INDEX "note_details_workspace_id_folder_id_idx" ON "note_details"("workspace_id", "folder_id");

-- CreateIndex
CREATE INDEX "note_details_workspace_id_pinned_idx" ON "note_details"("workspace_id", "pinned");

-- CreateIndex
CREATE INDEX "idea_details_workspace_id_status_idx" ON "idea_details"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "idea_details_workspace_id_category_idx" ON "idea_details"("workspace_id", "category");

-- CreateIndex
CREATE INDEX "checklist_items_workspace_id_server_seq_idx" ON "checklist_items"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "checklist_items_item_id_sort_key_idx" ON "checklist_items"("item_id", "sort_key");

-- CreateIndex
CREATE INDEX "tags_workspace_id_server_seq_idx" ON "tags"("workspace_id", "server_seq");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspace_id_slug_key" ON "tags"("workspace_id", "slug");

-- CreateIndex
CREATE INDEX "item_tags_workspace_id_tag_id_item_id_idx" ON "item_tags"("workspace_id", "tag_id", "item_id");

-- CreateIndex
CREATE INDEX "item_tags_workspace_id_server_seq_idx" ON "item_tags"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "note_folders_workspace_id_server_seq_idx" ON "note_folders"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "note_folders_workspace_id_parent_id_sort_key_idx" ON "note_folders"("workspace_id", "parent_id", "sort_key");

-- CreateIndex
CREATE INDEX "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

-- CreateIndex
CREATE INDEX "reminders_workspace_id_server_seq_idx" ON "reminders"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "reminders_item_id_idx" ON "reminders"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_workspace_id_server_seq_idx" ON "attachments"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "attachments_item_id_idx" ON "attachments"("item_id");

-- CreateIndex
CREATE INDEX "item_links_workspace_id_server_seq_idx" ON "item_links"("workspace_id", "server_seq");

-- CreateIndex
CREATE INDEX "item_links_to_item_id_idx" ON "item_links"("to_item_id");

-- CreateIndex
CREATE INDEX "activities_workspace_id_created_at_idx" ON "activities"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_entity_type_entity_id_idx" ON "activities"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_operations_workspace_id_applied_at_idx" ON "sync_operations"("workspace_id", "applied_at");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_details" ADD CONSTRAINT "task_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_details" ADD CONSTRAINT "note_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_details" ADD CONSTRAINT "note_details_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "note_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_details" ADD CONSTRAINT "idea_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_details" ADD CONSTRAINT "idea_details_converted_to_project_id_fkey" FOREIGN KEY ("converted_to_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "note_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_from_item_id_fkey" FOREIGN KEY ("from_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_to_item_id_fkey" FOREIGN KEY ("to_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
