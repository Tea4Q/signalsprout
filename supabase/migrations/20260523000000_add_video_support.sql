-- Add video asset type and media_type column to posts

-- 1. Extend asset_type enum with uploaded_video
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'uploaded_video';

-- 2. Add media_type to posts (image = photo/carousel, video = Reels/TikTok video)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image'
  CONSTRAINT posts_media_type_check CHECK (media_type IN ('image', 'video'));

COMMENT ON COLUMN posts.media_type IS 'Content media type: image (photos / carousels) or video (Instagram Reels, TikTok video)';
