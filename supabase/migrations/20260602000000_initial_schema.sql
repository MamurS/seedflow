-- ============================================================================
-- SeedFlow — initial database schema
-- ----------------------------------------------------------------------------
-- This migration provisions the full backend that the SeedFlow frontend
-- (src/hooks/*, src/stores/*) already queries. The table/column definitions
-- mirror src/types/database.ts exactly.
--
-- Conventions (auth, RLS, updated_at trigger, roles) are adapted from the
-- seed-merchant-hub backend and reconciled against SeedFlow's data model,
-- which renamed and extended several tables relative to that earlier schema:
--   import_costs -> delivery_costs   fixed_costs -> opex (+ opex_allocation)
--   payments     -> inkasso          (new) dealers, cash_register,
--                                     supplier_commissions, exchange_rates
-- ============================================================================

-- ─── Shared helpers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ─── Auth: profiles & roles ───────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Convenience: every authenticated user gets full CRUD on the business tables.
-- (Granular admin/staff separation can layer on top via has_role later.)

-- ─── Suppliers ──────────────────────────────────────────────────────────────

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view suppliers"   ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Products ───────────────────────────────────────────────────────────────

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  variety TEXT,
  unit TEXT NOT NULL DEFAULT 'pack',
  seeds_per_pack NUMERIC(12,2),
  map_price NUMERIC(12,2),
  map_currency TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view products"   ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete products" ON public.products FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_products_supplier_id ON public.products(supplier_id);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Dealers ────────────────────────────────────────────────────────────────

CREATE TABLE public.dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  region TEXT,
  payment_terms TEXT CHECK (payment_terms IN ('prepayment', 'deferred_30', 'deferred_60', 'deferred_90')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view dealers"   ON public.dealers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert dealers" ON public.dealers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update dealers" ON public.dealers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete dealers" ON public.dealers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON public.dealers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Deliveries ─────────────────────────────────────────────────────────────

CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT,
  invoice_date DATE,
  order_date DATE,
  payment_date DATE,
  ship_date DATE,
  customs_start_date DATE,
  customs_clear_date DATE,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('ordered', 'invoiced', 'paid', 'in_transit', 'customs', 'cleared', 'delivered')),
  total_cip_usd NUMERIC(14,2),
  airfreight_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(12,2),
  cycle_start_month TEXT,
  cycle_end_month TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view deliveries"   ON public.deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert deliveries" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete deliveries" ON public.deliveries FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_deliveries_supplier_id ON public.deliveries(supplier_id);
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Delivery items ─────────────────────────────────────────────────────────

CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  cip_price_usd NUMERIC(12,2) NOT NULL,
  -- GENERATED: kept in sync by Postgres, never written by the app
  total_cip_usd NUMERIC(16,2) GENERATED ALWAYS AS (quantity * cip_price_usd) STORED,
  landed_cost_usd NUMERIC(12,2),
  recommended_price_usd NUMERIC(12,2),
  margin_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  official_price_uzs NUMERIC(15,0),
  test_packs_qty INTEGER NOT NULL DEFAULT 0,
  sellable_qty INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view delivery items"   ON public.delivery_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert delivery items" ON public.delivery_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update delivery items" ON public.delivery_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete delivery items" ON public.delivery_items FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_product_id  ON public.delivery_items(product_id);

-- ─── Delivery costs (landed-cost line items) ────────────────────────────────

CREATE TABLE public.delivery_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL
    CHECK (cost_type IN (
      'vat', 'customs_duty', 'akd', 'ikt', 'airfreight', 'warehouse_storage',
      'broker_commission', 'broker_delivery', 'quarantine_test',
      'agroinspection_test', 'test_packs', 'qr_code', 'other'
    )),
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('UZS', 'USD')),
  amount_usd NUMERIC(14,2) NOT NULL,
  document_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view delivery costs"   ON public.delivery_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert delivery costs" ON public.delivery_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update delivery costs" ON public.delivery_costs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete delivery costs" ON public.delivery_costs FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_delivery_costs_delivery_id ON public.delivery_costs(delivery_id);

-- ─── Operating expenses (OpEx) ──────────────────────────────────────────────

CREATE TABLE public.opex (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,  -- 'YYYY-MM'
  category TEXT NOT NULL
    CHECK (category IN (
      'rent', 'accounting', 'cash_register', 'salary', 'payroll_tax',
      'income_tax', 'bank_fees', 'other'
    )),
  description TEXT,
  amount_uzs NUMERIC(18,0),
  amount_usd NUMERIC(14,2),
  exchange_rate NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opex ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view opex"   ON public.opex FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert opex" ON public.opex FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update opex" ON public.opex FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete opex" ON public.opex FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_opex_month ON public.opex(month);

-- ─── OpEx allocation (spreading OpEx across deliveries) ─────────────────────

CREATE TABLE public.opex_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opex_id UUID NOT NULL REFERENCES public.opex(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- 'YYYY-MM'
  allocated_amount_usd NUMERIC(14,2) NOT NULL,
  allocation_pct NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opex_allocation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view opex allocation"   ON public.opex_allocation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert opex allocation" ON public.opex_allocation FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update opex allocation" ON public.opex_allocation FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete opex allocation" ON public.opex_allocation FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_opex_allocation_opex_id     ON public.opex_allocation(opex_id);
CREATE INDEX idx_opex_allocation_delivery_id ON public.opex_allocation(delivery_id);

-- ─── Sales ──────────────────────────────────────────────────────────────────

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  delivery_item_id UUID NOT NULL REFERENCES public.delivery_items(id) ON DELETE RESTRICT,
  sale_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  real_price_per_pack NUMERIC(14,2) NOT NULL,
  official_price_per_pack_uzs NUMERIC(15,0),
  total_real_usd NUMERIC(16,2),
  total_official_uzs NUMERIC(18,0),
  payment_terms TEXT NOT NULL
    CHECK (payment_terms IN ('prepayment', 'deferred_30', 'deferred_60', 'deferred_90')),
  payment_due_date DATE,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  payment_received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view sales"   ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update sales" ON public.sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete sales" ON public.sales FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_sales_dealer_id        ON public.sales(dealer_id);
CREATE INDEX idx_sales_delivery_item_id ON public.sales(delivery_item_id);
CREATE INDEX idx_sales_sale_date        ON public.sales(sale_date DESC);
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Inkasso (cash collections) ─────────────────────────────────────────────

CREATE TABLE public.inkasso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inkasso_date DATE NOT NULL,
  total_amount_uzs NUMERIC(18,0) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inkasso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view inkasso"   ON public.inkasso FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inkasso" ON public.inkasso FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update inkasso" ON public.inkasso FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete inkasso" ON public.inkasso FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_inkasso_date ON public.inkasso(inkasso_date DESC);

-- ─── Cash register (fiscal registrations) ───────────────────────────────────

CREATE TABLE public.cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_item_id UUID NOT NULL REFERENCES public.delivery_items(id) ON DELETE RESTRICT,
  register_date DATE NOT NULL,
  packs_registered INTEGER NOT NULL,
  amount_uzs NUMERIC(18,0) NOT NULL,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view cash register"   ON public.cash_register FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cash register" ON public.cash_register FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cash register" ON public.cash_register FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete cash register" ON public.cash_register FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_cash_register_delivery_item_id ON public.cash_register(delivery_item_id);
CREATE INDEX idx_cash_register_date             ON public.cash_register(register_date DESC);

-- ─── Supplier / manager commissions ─────────────────────────────────────────

CREATE TABLE public.supplier_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('supplier', 'manager')),
  amount_usd NUMERIC(14,2) NOT NULL,
  description TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view supplier commissions"   ON public.supplier_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert supplier commissions" ON public.supplier_commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update supplier commissions" ON public.supplier_commissions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete supplier commissions" ON public.supplier_commissions FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_supplier_commissions_delivery_id ON public.supplier_commissions(delivery_id);

-- ─── Exchange rates (USD→UZS history) ───────────────────────────────────────

CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  usd_uzs NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view exchange rates"   ON public.exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert exchange rates" ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update exchange rates" ON public.exchange_rates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete exchange rates" ON public.exchange_rates FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_exchange_rates_date ON public.exchange_rates(date DESC);
