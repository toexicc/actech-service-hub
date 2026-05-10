
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'technician', 'management');

CREATE TYPE public.service_status AS ENUM (
  'Pending Diagnosis',
  'Confirmed Diagnosis',
  'Waiting to Proceed',
  'Proceed Repair',
  'Ongoing Service',
  'Done Repair - Under Observation',
  'Done Repair - For Release',
  'Done Repair - Advise Client',
  'Completed',
  'Backjob',
  'RTO',
  'On Hold',
  'Cancelled'
);

CREATE TYPE public.service_file_kind AS ENUM (
  'intake',
  'quotation',
  'signature',
  'annotation',
  'device_report'
);

-- =====================================================
-- PROFILES (mirrors auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  department TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  salary NUMERIC NOT NULL DEFAULT 0,
  salary_type TEXT NOT NULL DEFAULT 'monthly',
  staff_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER ROLES (separate table)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_management(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'management')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_name()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.profiles WHERE id = auth.uid();
$$;

-- Profiles RLS
CREATE POLICY "Anyone authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_or_management(auth.uid()));
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_management(auth.uid()) OR id = auth.uid());
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
CREATE POLICY "Authenticated can read roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- CLIENTS
-- =====================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- SERVICES (the main repair ticket table)
-- =====================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id TEXT UNIQUE NOT NULL,
  client_id TEXT,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  address TEXT,
  device_type TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  service TEXT,
  issue_description TEXT,
  diagnosis TEXT,
  ai_report TEXT,
  status public.service_status NOT NULL DEFAULT 'Pending Diagnosis',
  priority TEXT,
  technicians TEXT[] NOT NULL DEFAULT '{}',
  technician_departments TEXT[] NOT NULL DEFAULT '{}',
  admin_reps TEXT[] NOT NULL DEFAULT '{}',
  receiving_staff TEXT,
  date_received TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_date DATE,
  estimated_completion TEXT,
  date_completed TIMESTAMPTZ,
  parts_used TEXT[] NOT NULL DEFAULT '{}',
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  service_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  initial_payment NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT,
  mode_of_transfer TEXT,
  remarks TEXT,
  internal_admin_notes TEXT,
  internal_technician_notes TEXT,
  ai_toggle TEXT,
  pre_order TEXT,
  part_id TEXT,
  drive_folder_url TEXT,
  device_report_folder_url TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX services_status_idx ON public.services(status);
CREATE INDEX services_service_id_idx ON public.services(service_id);
CREATE INDEX services_technicians_idx ON public.services USING GIN(technicians);
CREATE INDEX services_admin_reps_idx ON public.services USING GIN(admin_reps);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/management read all services"
  ON public.services FOR SELECT TO authenticated
  USING (public.is_admin_or_management(auth.uid()));
CREATE POLICY "Technicians read assigned services"
  ON public.services FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'technician')
    AND public.get_my_name() = ANY(technicians)
  );
CREATE POLICY "Auth users insert services"
  ON public.services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins/management update services"
  ON public.services FOR UPDATE TO authenticated
  USING (public.is_admin_or_management(auth.uid()));
CREATE POLICY "Technicians update assigned services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'technician')
    AND public.get_my_name() = ANY(technicians)
  );
CREATE POLICY "Admins delete services"
  ON public.services FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update last_updated
CREATE OR REPLACE FUNCTION public.set_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.last_updated = now(); RETURN NEW; END;
$$;
CREATE TRIGGER services_last_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_last_updated();

-- Service ID generator (AC + 11 digits)
CREATE OR REPLACE FUNCTION public.generate_service_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'AC' || LPAD(FLOOR(RANDOM() * 100000000000)::TEXT, 11, '0');
  RETURN v_id;
END;
$$;

-- =====================================================
-- SERVICE FILES (replaces sheet link columns)
-- =====================================================
CREATE TABLE public.service_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id TEXT NOT NULL REFERENCES public.services(service_id) ON DELETE CASCADE,
  kind public.service_file_kind NOT NULL,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX service_files_service_idx ON public.service_files(service_id);
CREATE INDEX service_files_kind_idx ON public.service_files(service_id, kind);
ALTER TABLE public.service_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read service files" ON public.service_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write service files" ON public.service_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- CLIENT INQUIRIES
-- =====================================================
CREATE TABLE public.client_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  device_type TEXT,
  brand TEXT,
  model TEXT,
  issue_description TEXT,
  mode_of_transfer TEXT,
  status TEXT,
  ai_toggle TEXT,
  pre_order TEXT,
  initial_payment NUMERIC DEFAULT 0,
  part_id TEXT,
  notes TEXT,
  service_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read inquiries" ON public.client_inquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write inquiries" ON public.client_inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER inquiries_updated BEFORE UPDATE ON public.client_inquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- INVENTORY
-- =====================================================
CREATE TABLE public.inventory_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id TEXT UNIQUE NOT NULL,
  part_name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  device_model TEXT,
  part_type TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'In Stock',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read inventory" ON public.inventory_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mgmt write inventory" ON public.inventory_parts FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()) OR public.has_role(auth.uid(), 'technician'))
  WITH CHECK (public.is_admin_or_management(auth.uid()) OR public.has_role(auth.uid(), 'technician'));
CREATE TRIGGER inventory_parts_updated BEFORE UPDATE ON public.inventory_parts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fast_moving_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id TEXT UNIQUE NOT NULL,
  part_name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  device_model TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Stock',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fast_moving_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read fast parts" ON public.fast_moving_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write fast parts" ON public.fast_moving_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER fast_parts_updated BEFORE UPDATE ON public.fast_moving_parts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.part_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  part_id TEXT,
  part_name TEXT,
  brand TEXT,
  device_model TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'For Ordering',
  service_id TEXT,
  inquiry_id TEXT,
  requested_by_name TEXT,
  requested_by UUID REFERENCES auth.users(id),
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read part requests" ON public.part_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write part requests" ON public.part_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER part_requests_updated BEFORE UPDATE ON public.part_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.part_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id TEXT,
  action TEXT NOT NULL,
  quantity INTEGER,
  service_id TEXT,
  performed_by_name TEXT,
  performed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.part_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read part logs" ON public.part_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert part logs" ON public.part_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- POS / TRANSACTIONS / FUNDS / EXPENSES
-- =====================================================
CREATE TABLE public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read funds" ON public.funds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mgmt write funds" ON public.funds FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()))
  WITH CHECK (public.is_admin_or_management(auth.uid()));
CREATE TRIGGER funds_updated BEFORE UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  fund_id UUID REFERENCES public.funds(id),
  fund_name TEXT,
  category TEXT,
  description TEXT,
  service_id TEXT,
  client_name TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'Completed',
  created_by_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_date_idx ON public.transactions(transaction_date DESC);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id TEXT UNIQUE NOT NULL,
  category TEXT,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  fund_id UUID REFERENCES public.funds(id),
  fund_name TEXT,
  payment_method TEXT,
  vendor TEXT,
  receipt_path TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mgmt write expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()))
  WITH CHECK (public.is_admin_or_management(auth.uid()));
CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT,
  category TEXT NOT NULL DEFAULT 'service',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  service_id TEXT,
  thread_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON public.notifications(recipient_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "Auth insert notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- =====================================================
-- MESSAGING (threads, members, messages, receipts, typing)
-- =====================================================
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);
CREATE INDEX chat_members_thread_idx ON public.chat_members(thread_id);
CREATE INDEX chat_members_user_idx ON public.chat_members(user_id);
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.chat_members WHERE thread_id = _thread_id AND user_id = _user_id);
$$;

CREATE POLICY "Members read threads" ON public.chat_threads FOR SELECT TO authenticated
  USING (public.is_thread_member(id, auth.uid()));
CREATE POLICY "Auth create threads" ON public.chat_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members update threads" ON public.chat_threads FOR UPDATE TO authenticated
  USING (public.is_thread_member(id, auth.uid()));

CREATE POLICY "Members read members" ON public.chat_members FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id, auth.uid()));
CREATE POLICY "Auth add members" ON public.chat_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Self remove member" ON public.chat_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_management(auth.uid()));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_name TEXT,
  body TEXT,
  attachment_path TEXT,
  attachment_kind TEXT,
  reply_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON public.messages(thread_id, created_at DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id, auth.uid()));
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_thread_member(thread_id, auth.uid()) AND sender_id = auth.uid());
CREATE POLICY "Sender deletes own message" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE TABLE public.read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read receipts" ON public.read_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert own receipt" ON public.read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.typing_indicators (
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read typing" ON public.typing_indicators FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id, auth.uid()));
CREATE POLICY "Self upsert typing" ON public.typing_indicators FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_created_idx ON public.activity_logs(created_at DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mgmt read activity" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_management(auth.uid()));
CREATE POLICY "Auth insert activity" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- CLOSED DATES
-- =====================================================
CREATE TABLE public.closed_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_date DATE UNIQUE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.closed_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read closed" ON public.closed_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mgmt write closed" ON public.closed_dates FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()))
  WITH CHECK (public.is_admin_or_management(auth.uid()));

-- =====================================================
-- SALARY DISBURSEMENTS
-- =====================================================
CREATE TABLE public.salary_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  workdays_in_period INTEGER NOT NULL DEFAULT 0,
  days_present NUMERIC NOT NULL DEFAULT 0,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  contribution_pagibig NUMERIC NOT NULL DEFAULT 0,
  contribution_sss NUMERIC NOT NULL DEFAULT 0,
  contribution_philhealth NUMERIC NOT NULL DEFAULT 0,
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  disbursed_at TIMESTAMPTZ,
  disbursed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, period_label)
);
ALTER TABLE public.salary_disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mgmt read salary" ON public.salary_disbursements FOR SELECT TO authenticated
  USING (public.is_admin_or_management(auth.uid()) OR staff_id = auth.uid());
CREATE POLICY "Mgmt write salary" ON public.salary_disbursements FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()))
  WITH CHECK (public.is_admin_or_management(auth.uid()));
CREATE TRIGGER salary_updated BEFORE UPDATE ON public.salary_disbursements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- STORAGE BUCKETS (private)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('intake-forms', 'intake-forms', false),
  ('quotation-forms', 'quotation-forms', false),
  ('signatures', 'signatures', false),
  ('annotations', 'annotations', false),
  ('device-reports', 'device-reports', false),
  ('chat-attachments', 'chat-attachments', false),
  ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read/write all the above buckets
CREATE POLICY "Auth read service buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('intake-forms','quotation-forms','signatures','annotations','device-reports','chat-attachments','expense-receipts'));

CREATE POLICY "Auth upload service buckets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('intake-forms','quotation-forms','signatures','annotations','device-reports','chat-attachments','expense-receipts'));

CREATE POLICY "Auth update service buckets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('intake-forms','quotation-forms','signatures','annotations','device-reports','chat-attachments','expense-receipts'));

CREATE POLICY "Auth delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('intake-forms','quotation-forms','signatures','annotations','device-reports','chat-attachments','expense-receipts')
    AND (owner = auth.uid() OR public.is_admin_or_management(auth.uid()))
  );

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.read_receipts;
