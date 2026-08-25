update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json'
    ]::text[]
where id = 'editorial';
