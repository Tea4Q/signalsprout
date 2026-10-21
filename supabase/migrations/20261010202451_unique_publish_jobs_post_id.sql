WITH ranked_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY post_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.publish_jobs
)
DELETE FROM public.publish_jobs AS jobs
USING ranked_jobs
WHERE jobs.id = ranked_jobs.id
  AND ranked_jobs.duplicate_rank > 1;

ALTER TABLE public.publish_jobs
  ADD CONSTRAINT publish_jobs_post_id_key UNIQUE (post_id);