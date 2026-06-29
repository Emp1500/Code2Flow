-- Profiles (auto-created by trigger on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flowcharts
CREATE TABLE IF NOT EXISTS flowcharts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled' CHECK (char_length(title) <= 100),
  language      TEXT NOT NULL DEFAULT 'javascript'
                  CHECK (language IN ('javascript', 'typescript', 'python')),
  is_public     BOOLEAN NOT NULL DEFAULT false,
  share_id      TEXT UNIQUE,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Version history
CREATE TABLE IF NOT EXISTS flowchart_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flowchart_id   UUID NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  code           TEXT NOT NULL CHECK (char_length(code) <= 50000),
  version_number INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flowcharts_updated_at
  BEFORE UPDATE ON flowcharts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowcharts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowchart_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile"    ON profiles          USING (auth.uid() = id);
CREATE POLICY "owners_full"    ON flowcharts        USING (auth.uid() = user_id);
CREATE POLICY "public_read"    ON flowcharts        FOR SELECT USING (is_public = true);
CREATE POLICY "owner_versions" ON flowchart_versions
  USING (flowchart_id IN (SELECT id FROM flowcharts WHERE user_id = auth.uid()));
