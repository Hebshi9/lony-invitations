
-- Create a public bucket for invitation cards
insert into storage.buckets (id, name, public)
values ('cards', 'cards', true)
on conflict (id) do nothing;

-- Policy: Allow public read access to cards
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'cards' );

-- Policy: Allow authenticated users to upload cards
create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'cards' and auth.role() = 'authenticated' );

-- Policy: Allow users to update their own uploads (or just all auth users for now)
create policy "Authenticated Update"
  on storage.objects for update
  using ( bucket_id = 'cards' and auth.role() = 'authenticated' );
