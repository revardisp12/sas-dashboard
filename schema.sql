-- ============================================================
-- SAS Dashboard — Supabase Schema
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'cs'
              CHECK (role IN ('super_admin','admin','manager','cs','crm')),
  brand       TEXT CHECK (brand IN ('reglow','amura')), -- NULL = super_admin
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku        TEXT NOT NULL,
  name       TEXT NOT NULL,
  price      NUMERIC NOT NULL DEFAULT 0,
  cogs       NUMERIC NOT NULL DEFAULT 0,
  margin     NUMERIC NOT NULL DEFAULT 0,
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bundles
CREATE TABLE IF NOT EXISTS bundles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]',
  price      NUMERIC NOT NULL DEFAULT 0,
  cogs       NUMERIC NOT NULL DEFAULT 0,
  margin     NUMERIC NOT NULL DEFAULT 0,
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (CRM follow-up)
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  phone         TEXT,
  segment       TEXT,
  note          TEXT,
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo','ongoing','done')),
  brand         TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sales (CS)
CREATE TABLE IF NOT EXISTS sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand        TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date         TEXT NOT NULL,
  product      TEXT NOT NULL DEFAULT '',
  qty          INTEGER NOT NULL DEFAULT 0,
  revenue      NUMERIC NOT NULL DEFAULT 0,
  channel      TEXT DEFAULT '',
  cogs         NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0,
  customer_name TEXT DEFAULT '',
  phone        TEXT DEFAULT '',
  address      TEXT DEFAULT '',
  source       TEXT DEFAULT 'organic',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- CRM
CREATE TABLE IF NOT EXISTS crm (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date          TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  product       TEXT NOT NULL DEFAULT '',
  qty           INTEGER NOT NULL DEFAULT 0,
  revenue       NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Google Ads
CREATE TABLE IF NOT EXISTS google_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date        TEXT NOT NULL,
  campaign    TEXT DEFAULT '',
  impressions INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  ctr         NUMERIC DEFAULT 0,
  cpc         NUMERIC DEFAULT 0,
  spend       NUMERIC DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conv_rate   NUMERIC DEFAULT 0,
  roas        NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Meta Ads
CREATE TABLE IF NOT EXISTS meta_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date        TEXT NOT NULL,
  campaign    TEXT DEFAULT '',
  reach       INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  ctr         NUMERIC DEFAULT 0,
  spend       NUMERIC DEFAULT 0,
  purchases   INTEGER DEFAULT 0,
  roas        NUMERIC DEFAULT 0,
  cpm         NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TikTok Shop
CREATE TABLE IF NOT EXISTS tiktok_shop (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date          TEXT NOT NULL,
  gmv           NUMERIC DEFAULT 0,
  orders        INTEGER DEFAULT 0,
  units_sold    INTEGER DEFAULT 0,
  revenue       NUMERIC DEFAULT 0,
  product_views INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Shopee
CREATE TABLE IF NOT EXISTS shopee (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand          TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date           TEXT NOT NULL,
  gmv            NUMERIC DEFAULT 0,
  orders         INTEGER DEFAULT 0,
  units_sold     INTEGER DEFAULT 0,
  revenue        NUMERIC DEFAULT 0,
  product_views  INTEGER DEFAULT 0,
  ad_spend       NUMERIC DEFAULT 0,
  ad_clicks      INTEGER DEFAULT 0,
  ad_impressions INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Instagram
CREATE TABLE IF NOT EXISTS instagram (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand          TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date           TEXT NOT NULL,
  followers      INTEGER DEFAULT 0,
  reach          INTEGER DEFAULT 0,
  impressions    INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  engagements    INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TikTok Organic
CREATE TABLE IF NOT EXISTS tiktok_organic (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura')),
  date       TEXT NOT NULL,
  followers  INTEGER DEFAULT 0,
  views      INTEGER DEFAULT 0,
  likes      INTEGER DEFAULT 0,
  comments   INTEGER DEFAULT 0,
  shares     INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm            ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_shop    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee         ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_organic ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_brand()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT brand FROM user_profiles WHERE id = auth.uid()
$$;

-- user_profiles
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() IN ('super_admin','admin'));
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE
  USING (id = auth.uid() OR get_my_role() IN ('super_admin','admin'));

-- products
CREATE POLICY "products_select" ON products FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "products_write" ON products FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- bundles
CREATE POLICY "bundles_select" ON bundles FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "bundles_write" ON bundles FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "tasks_write" ON tasks FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager','crm') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- sales
CREATE POLICY "sales_select" ON sales FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "sales_write" ON sales FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager','cs') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- crm
CREATE POLICY "crm_select" ON crm FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "crm_write" ON crm FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager','crm') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- platform tables (manager+ write)
CREATE POLICY "google_ads_select" ON google_ads FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "google_ads_write" ON google_ads FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

CREATE POLICY "meta_ads_select" ON meta_ads FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "meta_ads_write" ON meta_ads FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

CREATE POLICY "tiktok_shop_select" ON tiktok_shop FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "tiktok_shop_write" ON tiktok_shop FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

CREATE POLICY "shopee_select" ON shopee FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "shopee_write" ON shopee FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

CREATE POLICY "instagram_select" ON instagram FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "instagram_write" ON instagram FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

CREATE POLICY "tiktok_organic_select" ON tiktok_organic FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
CREATE POLICY "tiktok_organic_write" ON tiktok_organic FOR ALL
  USING (get_my_role() IN ('super_admin','admin','manager') AND
         (get_my_role() = 'super_admin' OR brand = get_my_brand()));

-- ============================================================
-- Trigger: auto-create user_profiles on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'cs')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
