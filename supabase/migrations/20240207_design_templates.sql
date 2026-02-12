-- Create Design Templates Table
create table if not exists design_templates (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references events(id) on delete cascade not null,
  name text not null,
  background_url text not null, -- Image/Video URL from Storage
  canvas_config jsonb default '{}'::jsonb, -- Fabric.js or Konva JSON
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table design_templates enable row level security;

-- Policies (Allow authenticated users to manage their event templates)
create policy "Users can view their own templates"
  on design_templates for select
  using ( auth.uid() in ( select user_id from events where id = event_id ) );

create policy "Users can insert their own templates"
  on design_templates for insert
  with check ( auth.uid() in ( select user_id from events where id = event_id ) );

create policy "Users can update their own templates"
  on design_templates for update
  using ( auth.uid() in ( select user_id from events where id = event_id ) );

create policy "Users can delete their own templates"
  on design_templates for delete
  using ( auth.uid() in ( select user_id from events where id = event_id ) );

-- Create Campaigns Table (Batch Sending)
create table if not exists campaigns (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references events(id) on delete cascade not null,
  template_id uuid references design_templates(id),
  name text not null,
  status text default 'draft', -- draft, sending, completed, failed
  total_guests int default 0,
  sent_count int default 0,
  failed_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table campaigns enable row level security;

create policy "Users can manage their campaigns"
  on campaigns for all
  using ( auth.uid() in ( select user_id from events where id = event_id ) );
