-- Products schema: enables projects to have multiple products (e.g. iOS app,
-- macOS app, Android app, Backend API) with descriptions for AI coding prompts.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create index if not exists products_project_id_idx on products(project_id);

alter table products enable row level security;

create policy "members can manage products in their orgs"
  on products for all
  using (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  )
  with check (
    project_id in (
      select id from projects where organization_id in (select auth_organization_ids())
    )
  );

-- Extend feedback_items to store associated products
alter table feedback_items
  add column if not exists products jsonb not null default '[]'::jsonb,
  add column if not exists product_keys text[] not null default '{}'::text[];

create index if not exists feedback_items_product_keys_idx
  on feedback_items using gin (product_keys);
