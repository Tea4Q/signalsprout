-- Marketing image workflow tables for app-specific brand assets and editable designs

create table if not exists public.app_brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  app_name text not null,
  app_description text,
  brand_colors jsonb not null default '{}'::jsonb,
  logo_url text,
  icon_url text,
  default_cta text,
  sample_headlines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_brands_workspace_app_name_idx
  on public.app_brands (workspace_id, app_name);

alter table public.app_brands enable row level security;

create trigger set_updated_at_app_brands
  before update on public.app_brands
  for each row execute function public.set_updated_at();

drop policy if exists "workspace_members_select_app_brands" on public.app_brands;
create policy "workspace_members_select_app_brands"
  on public.app_brands for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_app_brands" on public.app_brands;
create policy "workspace_members_insert_app_brands"
  on public.app_brands for insert
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_update_app_brands" on public.app_brands;
create policy "workspace_members_update_app_brands"
  on public.app_brands for update
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_delete_app_brands" on public.app_brands;
create policy "workspace_members_delete_app_brands"
  on public.app_brands for delete
  using (public.is_workspace_member(workspace_id));


create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  app_brand_id uuid not null references public.app_brands(id) on delete cascade,
  asset_type text not null,
  asset_url text not null,
  file_name text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_assets_workspace_brand_idx
  on public.brand_assets (workspace_id, app_brand_id, asset_type);

alter table public.brand_assets enable row level security;

create trigger set_updated_at_brand_assets
  before update on public.brand_assets
  for each row execute function public.set_updated_at();

drop policy if exists "workspace_members_select_brand_assets" on public.brand_assets;
create policy "workspace_members_select_brand_assets"
  on public.brand_assets for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_brand_assets" on public.brand_assets;
create policy "workspace_members_insert_brand_assets"
  on public.brand_assets for insert
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_update_brand_assets" on public.brand_assets;
create policy "workspace_members_update_brand_assets"
  on public.brand_assets for update
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_delete_brand_assets" on public.brand_assets;
create policy "workspace_members_delete_brand_assets"
  on public.brand_assets for delete
  using (public.is_workspace_member(workspace_id));


create table if not exists public.marketing_image_designs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  app_brand_id uuid not null references public.app_brands(id) on delete cascade,
  platform_format text not null,
  goal text not null,
  ai_prompt text not null,
  generated_background_url text,
  final_image_url text,
  screenshot_asset_id uuid references public.brand_assets(id) on delete set null,
  text_layers jsonb not null default '[]'::jsonb,
  design_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_image_designs_workspace_brand_idx
  on public.marketing_image_designs (workspace_id, app_brand_id, platform_format);

alter table public.marketing_image_designs enable row level security;

create trigger set_updated_at_marketing_image_designs
  before update on public.marketing_image_designs
  for each row execute function public.set_updated_at();

drop policy if exists "workspace_members_select_marketing_image_designs" on public.marketing_image_designs;
create policy "workspace_members_select_marketing_image_designs"
  on public.marketing_image_designs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_marketing_image_designs" on public.marketing_image_designs;
create policy "workspace_members_insert_marketing_image_designs"
  on public.marketing_image_designs for insert
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_update_marketing_image_designs" on public.marketing_image_designs;
create policy "workspace_members_update_marketing_image_designs"
  on public.marketing_image_designs for update
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_delete_marketing_image_designs" on public.marketing_image_designs;
create policy "workspace_members_delete_marketing_image_designs"
  on public.marketing_image_designs for delete
  using (public.is_workspace_member(workspace_id));