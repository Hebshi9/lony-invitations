-- Create invitation-cards bucket
insert into storage.buckets (id, name, public)
values ('invitation-cards', 'invitation-cards', true)
on conflict (id) do nothing;

-- Create intake_files bucket
insert into storage.buckets (id, name, public)
values ('intake_files', 'intake_files', true)
on conflict (id) do nothing;

-- Policy for invitation-cards (Public Read / Authenticated Upload)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'invitation-cards' );

create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'invitation-cards' and auth.role() = 'authenticated' );

-- Policy for intake_files (Public Upload for anon users / Authenticated Read)
create policy "Anon Upload"
  on storage.objects for insert
  with check ( bucket_id = 'intake_files' );

create policy "Authenticated Read"
  on storage.objects for select
  using ( bucket_id = 'intake_files' and auth.role() = 'authenticated' );
