ALTER TABLE projects
ADD COLUMN IF NOT EXISTS section_instructions JSONB DEFAULT '{}';