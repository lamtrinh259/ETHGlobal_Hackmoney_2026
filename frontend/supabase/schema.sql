-- Clawork HackMoney 2026 schema
-- Run in Supabase SQL editor.

create table if not exists public.agents (
  id text primary key,
  wallet_address text not null unique,
  name text not null,
  ens_name text,
  skills text[] not null default '{}',
  erc8004_id text,
  reputation jsonb not null default '{"score":0,"totalJobs":0,"positive":0,"negative":0,"confidence":0}'::jsonb,
  feedback_history jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_agents_wallet_address on public.agents (wallet_address);
create index if not exists idx_agents_created_at on public.agents (created_at desc);
create index if not exists idx_agents_ens_name on public.agents (ens_name);

create table if not exists public.bounties (
  id text primary key,
  title text not null,
  description text not null,
  reward numeric not null,
  reward_token text not null default 'USDC',
  type text not null default 'STANDARD',
  status text not null default 'OPEN',
  poster_address text not null,
  poster_name text,
  assigned_agent_id text references public.agents(id) on delete set null,
  assigned_agent_address text,
  assigned_agent_erc8004_id text,
  yellow_channel_id text,
  yellow_session_id text,
  settlement_tx_hash text,
  created_at bigint not null,
  claimed_at bigint,
  submitted_at bigint,
  completed_at bigint,
  submit_deadline bigint,
  review_deadline bigint,
  deliverable_cid text,
  deliverable_message text,
  required_skills text[] not null default '{}',
  requirements text not null default '',
  dispute_status text,
  dispute_reason text,
  dispute_timestamp bigint,
  dispute_initiator text,
  dispute_id text
);

create index if not exists idx_bounties_status on public.bounties (status);
create index if not exists idx_bounties_created_at on public.bounties (created_at desc);
create index if not exists idx_bounties_poster_address on public.bounties (poster_address);

create table if not exists public.disputes (
  id text primary key,
  bounty_id text not null references public.bounties(id) on delete cascade,
  agent_id text references public.agents(id) on delete set null,
  poster_address text not null,
  reason text not null,
  evidence_cid text,
  status text not null default 'PENDING',
  decision text,
  reviewed_by text,
  review_notes text,
  created_at bigint not null,
  resolved_at bigint
);

create index if not exists idx_disputes_bounty_id on public.disputes (bounty_id);
create index if not exists idx_disputes_status on public.disputes (status);

create table if not exists public.waitlist (
  id bigserial primary key,
  email text not null unique,
  source text not null default 'landing-page',
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_email on public.waitlist (email);

alter table public.agents enable row level security;
alter table public.bounties enable row level security;
alter table public.disputes enable row level security;
alter table public.waitlist enable row level security;

-- Keep policies permissive for hackathon API-key usage.
drop policy if exists "agents_all" on public.agents;
create policy "agents_all" on public.agents
  for all
  using (true)
  with check (true);

drop policy if exists "bounties_all" on public.bounties;
create policy "bounties_all" on public.bounties
  for all
  using (true)
  with check (true);

drop policy if exists "disputes_all" on public.disputes;
create policy "disputes_all" on public.disputes
  for all
  using (true)
  with check (true);

drop policy if exists "waitlist_all" on public.waitlist;
create policy "waitlist_all" on public.waitlist
  for all
  using (true)
  with check (true);
