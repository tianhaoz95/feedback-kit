-- Billing is per-organization (the tenancy boundary — see 0001_init.sql's
-- multi-tenancy model), not per-project: one Stripe customer/subscription
-- per team account, the same way GitHub or Linear bill a whole workspace.
--
-- This table and the checkout/portal/webhook Edge Functions alongside it
-- (supabase/functions/create-checkout-session, create-portal-session,
-- stripe-webhook) are built before a real Stripe account exists. Nothing
-- here talks to Stripe directly — the columns just mirror what a
-- subscription's webhook events report — so every organization defaults to
-- plan='free'/status='none' and stays there until Stripe is actually wired
-- up. Turning that into real billing later is purely a matter of setting
-- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID_PRO (see the
-- functions' own comments), not a schema or dashboard-code change.

create type billing_plan as enum ('free', 'pro');

-- Mirrors Stripe's own subscription statuses (see
-- https://docs.stripe.com/api/subscriptions/object#subscription_object-status)
-- plus 'none' for an organization that has never started a subscription.
create type billing_status as enum (
  'none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'
);

create table organization_billing (
  organization_id uuid primary key references organizations(id) on delete cascade,
  plan billing_plan not null default 'free',
  status billing_status not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table organization_billing enable row level security;

-- Read-only from the dashboard's perspective — every write comes from
-- create-checkout-session (setting stripe_customer_id, service role) or
-- stripe-webhook (everything else, service role, authenticated by Stripe's
-- signature rather than a Supabase JWT — see that function). No authenticated
-- user ever mutates this table directly, the same reasoning as feedback_items'
-- screenshot paths never being client-writable.
create policy "members can read their org's billing"
  on organization_billing for select
  using (organization_id in (select auth_organization_ids()));

-- Every organization gets a free-plan billing row the moment it's created —
-- same pattern as create_default_prompt_template() for projects — so the
-- dashboard only ever deals with "free" or "pro", never a third
-- "row doesn't exist yet" case.
create function create_default_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into organization_billing (organization_id) values (new.id);
  return new;
end;
$$;

create trigger on_organization_created
  after insert on organizations
  for each row execute function create_default_billing();

-- Backfill organizations that already existed before this migration.
insert into organization_billing (organization_id)
  select id from organizations
  on conflict (organization_id) do nothing;
