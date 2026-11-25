-- Phase 2 / Task 6: public bucket for doctor photographs.
-- Only the website owner can upload, replace, or remove photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doctor-photos',
  'doctor-photos',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

create policy "Doctor photos are publicly readable" on storage.objects
for select to public
using (bucket_id = 'doctor-photos');

create policy "Only owner can upload doctor photos" on storage.objects
for insert to authenticated
with check (bucket_id = 'doctor-photos' and public.current_admin_role() = 'OWNER');

create policy "Only owner can manage doctor photos" on storage.objects
for all to authenticated
using (bucket_id = 'doctor-photos' and public.current_admin_role() = 'OWNER')
with check (bucket_id = 'doctor-photos' and public.current_admin_role() = 'OWNER');
