-- Schema Table: shrimp_predictions
CREATE TABLE IF NOT EXISTS shrimp_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  image_url TEXT NOT NULL,
  model_1_output JSONB,
  model_2_output JSONB,
  model_3_output JSONB,
  human_is_shrimp BOOLEAN NOT NULL,
  selected_models TEXT[] DEFAULT '{}',
  notes TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE shrimp_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read & write for field app (or configure specific authenticated user)
CREATE POLICY "Allow anonymous select" ON shrimp_predictions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert" ON shrimp_predictions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete" ON shrimp_predictions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Storage bucket setup:
-- 1. Create a public bucket named 'smartambak' (or 'shrimp-images')
-- INSERT INTO storage.buckets (id, name, public) VALUES ('smartambak', 'smartambak', true) ON CONFLICT DO NOTHING;
--
-- Storage Policies for public upload & view:
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'smartambak');
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'smartambak');
