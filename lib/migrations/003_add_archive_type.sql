-- Add 'archive' to media type enum
ALTER TABLE media 
MODIFY COLUMN type ENUM('image','audio','video','archive') NOT NULL;
