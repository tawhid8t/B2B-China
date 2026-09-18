-- Screenshot evidence is private and is written only by authenticated API
-- routes using the server-side service role. OCR itself runs locally in the
-- user's browser; no screenshot is sent to an OCR provider.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cainiao-imports',
  'cainiao-imports',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.cainiao_import_batches.screenshot_path is
  'Private cainiao-imports storage object. Only evidence for a confirmed screenshot import is retained.';
