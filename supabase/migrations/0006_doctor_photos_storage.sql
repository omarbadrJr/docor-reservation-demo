-- Phase 2 / Task 6: public bucket for doctor photographs.
-- Supabase enables RLS on storage.objects and owns that managed table, so this
-- migration only declares the bucket. Uploads must go through a server route
-- using the service-role key; public downloads use the bucket's public URL.

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
