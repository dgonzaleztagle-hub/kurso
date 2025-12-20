CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_module; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_module AS ENUM (
    'dashboard',
    'students',
    'income',
    'expenses',
    'debt_reports',
    'payment_reports',
    'balance',
    'import',
    'movements',
    'activities',
    'activity_exclusions',
    'activity_payments',
    'monthly_fees',
    'payment_notifications',
    'reimbursements',
    'scheduled_activities',
    'student_profile',
    'credit_management',
    'credit_movements'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'master',
    'admin',
    'alumnos'
);


--
-- Name: credit_movement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credit_movement_type AS ENUM (
    'payment_redirect',
    'activity_refund',
    'payment_deduction',
    'manual_adjustment'
);


--
-- Name: reimbursement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reimbursement_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: reimbursement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reimbursement_type AS ENUM (
    'reimbursement',
    'supplier_payment'
);


--
-- Name: admin_has_permission(uuid, public.app_module); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_has_permission(_user_id uuid, _module public.app_module) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_permissions
    WHERE user_id = _user_id
      AND module = _module
  )
$$;


--
-- Name: assign_folio_to_reimbursement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_folio_to_reimbursement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_folio INTEGER;
BEGIN
  -- Solo asignar folio si no tiene uno ya
  IF NEW.folio IS NULL THEN
    next_folio := public.get_next_reimbursement_folio();
    NEW.folio := next_folio;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: create_expense_from_reimbursement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_expense_from_reimbursement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_folio INTEGER;
  supplier_name TEXT;
BEGIN
  -- Solo crear egreso si el estado cambió a 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Determinar el nombre del proveedor según el tipo
    IF NEW.type = 'supplier_payment' THEN
      supplier_name := NEW.supplier_name;
    ELSE
      supplier_name := NEW.account_info->>'holder_name';
    END IF;
    
    -- Si no hay proveedor/titular, usar 'Rendición'
    IF supplier_name IS NULL OR supplier_name = '' THEN
      supplier_name := 'Rendición';
    END IF;
    
    -- Obtener siguiente folio de egreso
    next_folio := public.get_next_expense_folio();
    
    -- Crear el egreso
    INSERT INTO public.expenses (
      folio,
      concept,
      supplier,
      amount,
      expense_date,
      created_at
    ) VALUES (
      next_folio,
      CASE 
        WHEN NEW.type = 'supplier_payment' THEN 
          CASE 
            WHEN NEW.folio IS NOT NULL THEN 'Pago a Proveedor #' || NEW.folio || ': ' || COALESCE(NEW.subject, 'Sin concepto')
            ELSE 'Pago a Proveedor: ' || COALESCE(NEW.subject, 'Sin concepto')
          END
        ELSE 
          CASE 
            WHEN NEW.folio IS NOT NULL THEN 'Rendición #' || NEW.folio || ': ' || COALESCE(NEW.subject, 'Sin concepto')
            ELSE 'Rendición: ' || COALESCE(NEW.subject, 'Sin concepto')
          END
      END,
      supplier_name,
      NEW.amount,
      COALESCE(NEW.processed_at::date, CURRENT_DATE),
      NOW()
    );
    
    -- Guardar el folio del egreso en la rendición
    NEW.expense_folio := next_folio;
  END IF;
  
  -- Si el estado cambia de approved/rejected a pending, eliminar el egreso asociado
  IF OLD.status IN ('approved', 'rejected') AND NEW.status = 'pending' THEN
    IF OLD.expense_folio IS NOT NULL THEN
      DELETE FROM public.expenses WHERE folio = OLD.expense_folio;
      NEW.expense_folio := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: generate_student_display_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_student_display_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  student_name_var text;
BEGIN
  -- Obtener el nombre del estudiante
  SELECT name INTO student_name_var
  FROM public.students
  WHERE id = NEW.student_id;
  
  -- Si no tiene display_name, asignar "Apoderado de {nombre}"
  IF NEW.display_name IS NULL THEN
    NEW.display_name := 'Apoderado de ' || student_name_var;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: get_next_expense_folio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_expense_folio() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_folio INTEGER;
BEGIN
  SELECT COALESCE(MAX(folio), 0) + 1 INTO next_folio FROM public.expenses;
  RETURN next_folio;
END;
$$;


--
-- Name: get_next_payment_folio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_payment_folio() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_folio INTEGER;
BEGIN
  SELECT COALESCE(MAX(folio), 0) + 1 INTO next_folio FROM public.payments;
  RETURN next_folio;
END;
$$;


--
-- Name: get_next_reimbursement_folio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_reimbursement_folio() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_folio INTEGER;
BEGIN
  SELECT COALESCE(MAX(folio), 0) + 1 INTO next_folio FROM public.reimbursements;
  RETURN next_folio;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: notify_new_reimbursement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_reimbursement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_phone_var TEXT;
  user_name_var TEXT;
  master_record RECORD;
  request_id BIGINT;
  function_url TEXT;
BEGIN
  RAISE LOG 'New reimbursement created with folio %', NEW.folio;
  
  -- URL de la edge function
  function_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
  IF function_url IS NULL THEN
    function_url := 'jneovqrcvrycakufbehc.supabase.co';
  END IF;
  function_url := 'https://' || function_url || '/functions/v1/send-reimbursement-notification';
  
  -- Obtener teléfono y nombre del usuario que creó la rendición
  SELECT phone, user_name INTO user_phone_var, user_name_var
  FROM public.user_roles
  WHERE user_id = NEW.user_id
  LIMIT 1;
  
  RAISE LOG 'Creator phone: %, Creator name: %', user_phone_var, user_name_var;
  
  -- Enviar SMS a todos los usuarios Master
  FOR master_record IN 
    SELECT ur.phone, ur.user_name, ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'master' 
      AND ur.phone IS NOT NULL 
      AND ur.phone != ''
  LOOP
    BEGIN
      SELECT INTO request_id net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_phone', master_record.phone,
          'user_name', COALESCE(master_record.user_name, 'Master'),
          'reimbursement_type', NEW.type,
          'subject', NEW.subject,
          'amount', NEW.amount,
          'status', 'pending',
          'folio', NEW.folio,
          'creator_name', COALESCE(user_name_var, 'Usuario'),
          'user_id', master_record.user_id
        )
      );
      
      RAISE LOG 'SMS notification sent to master %, request_id: %', master_record.user_name, request_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error sending SMS to %: %', master_record.user_name, SQLERRM;
    END;
  END LOOP;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send new reimbursement notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: notify_payment_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_payment_submission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  student_name_var TEXT;
  function_url TEXT;
BEGIN
  -- Get student name
  SELECT name INTO student_name_var
  FROM public.students
  WHERE id = NEW.student_id;

  -- Build the edge function URL
  function_url := 'https://jneovqrcvrycakufbehc.supabase.co/functions/v1/send-payment-notification';

  -- Call edge function asynchronously using pg_net with correct syntax
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'student_name', student_name_var,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date,
      'payer_name', NEW.payer_name,
      'bank', NEW.bank,
      'reference', NEW.reference
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send payment notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: notify_reimbursement_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_reimbursement_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_phone_var TEXT;
  user_name_var TEXT;
  function_url TEXT;
  http_response extensions.http_response;
BEGIN
  -- Solo notificar si el estado cambió a 'approved' o 'rejected'
  IF (NEW.status = 'approved' OR NEW.status = 'rejected') AND 
     (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    RAISE LOG 'Reimbursement status changed for folio %: % -> %', NEW.folio, OLD.status, NEW.status;
    
    -- URL de la edge function
    function_url := 'https://jneovqrcvrycakufbehc.supabase.co/functions/v1/send-reimbursement-notification';
    
    -- Obtener teléfono y nombre del usuario que creó la rendición
    SELECT phone, user_name INTO user_phone_var, user_name_var
    FROM public.user_roles
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    RAISE LOG 'User phone: %, User name: %', user_phone_var, user_name_var;
    
    -- Enviar SMS SOLO al creador de la rendición (si tiene teléfono)
    IF user_phone_var IS NOT NULL AND user_phone_var != '' THEN
      IF user_name_var IS NULL THEN
        user_name_var := 'Usuario';
      END IF;
      
      SELECT * INTO http_response FROM extensions.http((
        'POST',
        function_url,
        ARRAY[
          extensions.http_header('Content-Type', 'application/json'),
          extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZW92cXJjdnJ5Y2FrdWZiZWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkxMzg4OCwiZXhwIjoyMDc3NDg5ODg4fQ.b9XUJcmW3tq6V_S3vfIvvJn6u_Y_ixr-oKXBnEcB0Gk')
        ],
        'application/json',
        jsonb_build_object(
          'user_phone', user_phone_var,
          'user_name', user_name_var,
          'reimbursement_type', NEW.type,
          'subject', NEW.subject,
          'amount', NEW.amount,
          'status', NEW.status,
          'folio', NEW.folio,
          'rejection_reason', NEW.rejection_reason,
          'user_id', NEW.user_id
        )::text
      )::extensions.http_request);
      
      RAISE LOG 'SMS HTTP response status: %, body: %', http_response.status, http_response.content;
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send SMS notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: notify_supplier_payment_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_supplier_payment_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  master_record RECORD;
  request_id BIGINT;
  function_url TEXT;
  creator_name TEXT;
BEGIN
  -- Solo procesar si es un nuevo supplier_payment
  IF NEW.type != 'supplier_payment' OR TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Nuevo pago a proveedor creado: %', NEW.supplier_name;
  
  -- URL de la edge function
  function_url := current_setting('request.headers')::json->>'x-forwarded-host';
  IF function_url IS NULL THEN
    function_url := 'jneovqrcvrycakufbehc.supabase.co';
  END IF;
  function_url := 'https://' || function_url || '/functions/v1/send-reimbursement-notification';
  
  -- Determinar el nombre del creador
  IF NEW.user_id = '00000000-0000-0000-0000-000000000000' THEN
    creator_name := 'Portal Proveedores';
  ELSE
    SELECT user_name INTO creator_name
    FROM public.user_roles
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    IF creator_name IS NULL THEN
      creator_name := 'Usuario';
    END IF;
  END IF;
  
  -- Enviar SMS a todos los usuarios Master
  FOR master_record IN 
    SELECT ur.phone, ur.user_name, ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'master' 
      AND ur.phone IS NOT NULL 
      AND ur.phone != ''
  LOOP
    BEGIN
      SELECT INTO request_id net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_phone', master_record.phone,
          'user_name', COALESCE(master_record.user_name, 'Master'),
          'reimbursement_type', 'supplier_payment',
          'subject', NEW.subject,
          'amount', NEW.amount,
          'status', 'pending',
          'folio', NEW.folio,
          'creator_name', creator_name,
          'user_id', master_record.user_id
        )
      );
      
      RAISE LOG 'SMS enviado a master %, request_id: %', master_record.user_name, request_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error enviando SMS a %: %', master_record.user_name, SQLERRM;
    END;
  END LOOP;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en trigger notify_supplier_payment_created: %', SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: update_forms_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_forms_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_student_credit_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_student_credit_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insertar o actualizar el saldo del estudiante
  INSERT INTO public.student_credits (student_id, amount, updated_at)
  VALUES (NEW.student_id, NEW.amount, NOW())
  ON CONFLICT (student_id)
  DO UPDATE SET
    amount = student_credits.amount + NEW.amount,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;


--
-- Name: update_student_credits_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_student_credits_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_twilio_accounts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_twilio_accounts_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id integer NOT NULL,
    name text NOT NULL,
    amount numeric NOT NULL,
    activity_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    can_redirect_to_fees boolean DEFAULT false NOT NULL
);


--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activities ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: activity_donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_donations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scheduled_activity_id uuid NOT NULL,
    student_id integer,
    amount text DEFAULT 0 NOT NULL,
    donated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    cantidad_original text
);


--
-- Name: activity_exclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_exclusions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    activity_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_exclusions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activity_exclusions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_exclusions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: admin_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    module public.app_module NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id integer NOT NULL,
    amount numeric NOT NULL,
    type public.credit_movement_type NOT NULL,
    source_payment_id integer,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    details jsonb DEFAULT '[]'::jsonb
);


--
-- Name: dashboard_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    folio integer NOT NULL,
    supplier text NOT NULL,
    expense_date date NOT NULL,
    amount numeric(10,2) NOT NULL,
    concept text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: form_exclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_exclusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    student_id integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid()
);


--
-- Name: form_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    order_index integer NOT NULL,
    field_type text NOT NULL,
    label text NOT NULL,
    description text,
    is_required boolean DEFAULT false,
    options jsonb DEFAULT '[]'::jsonb,
    conditional_logic jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: form_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    user_id uuid,
    student_id integer,
    submitted_at timestamp with time zone DEFAULT now(),
    response_data jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    is_public boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requires_login boolean DEFAULT false,
    allow_multiple_responses boolean DEFAULT false,
    closes_at timestamp with time zone
);


--
-- Name: payment_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_id integer NOT NULL,
    payment_date date NOT NULL,
    amount numeric NOT NULL,
    payer_name text NOT NULL,
    bank text NOT NULL,
    payment_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_reason text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reference text,
    CONSTRAINT payment_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    folio integer NOT NULL,
    student_id integer,
    student_name text,
    payment_date date NOT NULL,
    amount numeric(10,2) NOT NULL,
    concept text NOT NULL,
    month_period text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activity_id integer,
    credit_applied numeric DEFAULT 0,
    redirected_from_payment_id integer,
    created_by uuid
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: reimbursements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reimbursements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    subject text NOT NULL,
    account_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public.reimbursement_status DEFAULT 'pending'::public.reimbursement_status NOT NULL,
    processed_by uuid,
    processed_at timestamp with time zone,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    rejection_reason text,
    folio integer,
    type public.reimbursement_type DEFAULT 'reimbursement'::public.reimbursement_type NOT NULL,
    supplier_name text,
    payment_proof jsonb,
    expense_folio integer
);


--
-- Name: scheduled_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    scheduled_date date NOT NULL,
    requires_management boolean DEFAULT false NOT NULL,
    is_with_fee boolean DEFAULT false NOT NULL,
    fee_amount numeric,
    is_with_donations boolean DEFAULT false NOT NULL,
    activity_id integer,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: scheduled_activity_exclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_activity_exclusions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    scheduled_activity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scheduled_activity_exclusions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_activity_exclusions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_activity_exclusions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_activity_exclusions_id_seq OWNED BY public.scheduled_activity_exclusions.id;


--
-- Name: student_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id integer NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id integer NOT NULL,
    name text NOT NULL,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: twilio_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twilio_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_name text NOT NULL,
    account_sid text NOT NULL,
    auth_token text NOT NULL,
    phone_number text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    first_login boolean DEFAULT true,
    user_name text,
    "position" text,
    phone text
);


--
-- Name: user_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    display_name text
);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: scheduled_activity_exclusions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activity_exclusions ALTER COLUMN id SET DEFAULT nextval('public.scheduled_activity_exclusions_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_donations activity_donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_donations
    ADD CONSTRAINT activity_donations_pkey PRIMARY KEY (id);


--
-- Name: activity_exclusions activity_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_exclusions
    ADD CONSTRAINT activity_exclusions_pkey PRIMARY KEY (id);


--
-- Name: activity_exclusions activity_exclusions_student_id_activity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_exclusions
    ADD CONSTRAINT activity_exclusions_student_id_activity_id_key UNIQUE (student_id, activity_id);


--
-- Name: admin_permissions admin_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_pkey PRIMARY KEY (id);


--
-- Name: admin_permissions admin_permissions_user_id_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_user_id_module_key UNIQUE (user_id, module);


--
-- Name: credit_movements credit_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_movements
    ADD CONSTRAINT credit_movements_pkey PRIMARY KEY (id);


--
-- Name: dashboard_notifications dashboard_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_notifications
    ADD CONSTRAINT dashboard_notifications_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_folio_key UNIQUE (folio);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: form_exclusions form_exclusions_form_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusions
    ADD CONSTRAINT form_exclusions_form_id_student_id_key UNIQUE (form_id, student_id);


--
-- Name: form_exclusions form_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusions
    ADD CONSTRAINT form_exclusions_pkey PRIMARY KEY (id);


--
-- Name: form_fields form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);


--
-- Name: form_responses form_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: payment_notifications payment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_notifications
    ADD CONSTRAINT payment_notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_folio_key UNIQUE (folio);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: reimbursements reimbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reimbursements
    ADD CONSTRAINT reimbursements_pkey PRIMARY KEY (id);


--
-- Name: scheduled_activities scheduled_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activities
    ADD CONSTRAINT scheduled_activities_pkey PRIMARY KEY (id);


--
-- Name: scheduled_activity_exclusions scheduled_activity_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activity_exclusions
    ADD CONSTRAINT scheduled_activity_exclusions_pkey PRIMARY KEY (id);


--
-- Name: scheduled_activity_exclusions scheduled_activity_exclusions_student_id_scheduled_activity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activity_exclusions
    ADD CONSTRAINT scheduled_activity_exclusions_student_id_scheduled_activity_key UNIQUE (student_id, scheduled_activity_id);


--
-- Name: student_credits student_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credits
    ADD CONSTRAINT student_credits_pkey PRIMARY KEY (id);


--
-- Name: student_credits student_credits_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credits
    ADD CONSTRAINT student_credits_student_id_key UNIQUE (student_id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: twilio_accounts twilio_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twilio_accounts
    ADD CONSTRAINT twilio_accounts_pkey PRIMARY KEY (id);


--
-- Name: twilio_accounts twilio_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twilio_accounts
    ADD CONSTRAINT twilio_accounts_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_students user_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_students
    ADD CONSTRAINT user_students_pkey PRIMARY KEY (id);


--
-- Name: user_students user_students_user_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_students
    ADD CONSTRAINT user_students_user_id_student_id_key UNIQUE (user_id, student_id);


--
-- Name: idx_activity_donations_scheduled_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_donations_scheduled_activity ON public.activity_donations USING btree (scheduled_activity_id);


--
-- Name: idx_activity_donations_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_donations_student ON public.activity_donations USING btree (student_id);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_payments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_date ON public.payments USING btree (payment_date);


--
-- Name: idx_payments_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_month ON public.payments USING btree (month_period);


--
-- Name: idx_payments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_student_id ON public.payments USING btree (student_id);


--
-- Name: idx_scheduled_activities_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_activities_completed ON public.scheduled_activities USING btree (completed);


--
-- Name: idx_scheduled_activities_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_activities_date ON public.scheduled_activities USING btree (scheduled_date);


--
-- Name: reimbursements assign_folio_on_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assign_folio_on_insert BEFORE INSERT ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.assign_folio_to_reimbursement();


--
-- Name: reimbursements notify_new_reimbursement_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_new_reimbursement_trigger AFTER INSERT ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.notify_new_reimbursement();


--
-- Name: reimbursements on_reimbursement_approved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_reimbursement_approved BEFORE UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.create_expense_from_reimbursement();


--
-- Name: reimbursements on_supplier_payment_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_supplier_payment_created AFTER INSERT ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.notify_supplier_payment_created();


--
-- Name: reimbursements reimbursement_status_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reimbursement_status_notification AFTER UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.notify_reimbursement_status_change();


--
-- Name: user_students set_student_display_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_student_display_name BEFORE INSERT ON public.user_students FOR EACH ROW EXECUTE FUNCTION public.generate_student_display_name();


--
-- Name: credit_movements update_credit_balance_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_balance_trigger AFTER INSERT ON public.credit_movements FOR EACH ROW EXECUTE FUNCTION public.update_student_credit_balance();


--
-- Name: forms update_forms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_forms_updated_at();


--
-- Name: student_credits update_student_credits_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_student_credits_timestamp BEFORE UPDATE ON public.student_credits FOR EACH ROW EXECUTE FUNCTION public.update_student_credits_updated_at();


--
-- Name: twilio_accounts update_twilio_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_twilio_accounts_updated_at BEFORE UPDATE ON public.twilio_accounts FOR EACH ROW EXECUTE FUNCTION public.update_twilio_accounts_updated_at();


--
-- Name: activity_donations activity_donations_scheduled_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_donations
    ADD CONSTRAINT activity_donations_scheduled_activity_id_fkey FOREIGN KEY (scheduled_activity_id) REFERENCES public.scheduled_activities(id) ON DELETE CASCADE;


--
-- Name: activity_donations activity_donations_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_donations
    ADD CONSTRAINT activity_donations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: activity_exclusions activity_exclusions_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_exclusions
    ADD CONSTRAINT activity_exclusions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_exclusions activity_exclusions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_exclusions
    ADD CONSTRAINT activity_exclusions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: admin_permissions admin_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credit_movements credit_movements_source_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_movements
    ADD CONSTRAINT credit_movements_source_payment_id_fkey FOREIGN KEY (source_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: credit_movements credit_movements_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_movements
    ADD CONSTRAINT credit_movements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: dashboard_notifications dashboard_notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_notifications
    ADD CONSTRAINT dashboard_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: form_exclusions form_exclusions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusions
    ADD CONSTRAINT form_exclusions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_exclusions form_exclusions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusions
    ADD CONSTRAINT form_exclusions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: form_fields form_fields_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_responses form_responses_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_responses form_responses_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: payment_notifications payment_notifications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_notifications
    ADD CONSTRAINT payment_notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: payments payments_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE SET NULL;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_redirected_from_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_redirected_from_payment_id_fkey FOREIGN KEY (redirected_from_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: scheduled_activities scheduled_activities_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activities
    ADD CONSTRAINT scheduled_activities_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE SET NULL;


--
-- Name: scheduled_activities scheduled_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activities
    ADD CONSTRAINT scheduled_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: scheduled_activity_exclusions scheduled_activity_exclusions_scheduled_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activity_exclusions
    ADD CONSTRAINT scheduled_activity_exclusions_scheduled_activity_id_fkey FOREIGN KEY (scheduled_activity_id) REFERENCES public.scheduled_activities(id) ON DELETE CASCADE;


--
-- Name: scheduled_activity_exclusions scheduled_activity_exclusions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_activity_exclusions
    ADD CONSTRAINT scheduled_activity_exclusions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_credits student_credits_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credits
    ADD CONSTRAINT student_credits_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_students user_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_students
    ADD CONSTRAINT user_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: user_students user_students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_students
    ADD CONSTRAINT user_students_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payment_notifications Admin and Master can view all notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and Master can view all notifications" ON public.payment_notifications FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: reimbursements Admins and masters can create reimbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can create reimbursements" ON public.reimbursements FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activities Admins and masters can delete activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete activities" ON public.activities FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_donations Admins and masters can delete donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete donations" ON public.activity_donations FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_exclusions Admins and masters can delete exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete exclusions" ON public.activity_exclusions FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: expenses Admins and masters can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete expenses" ON public.expenses FOR DELETE USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((created_by = auth.uid()) OR (created_by IS NULL)))));


--
-- Name: payments Admins and masters can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete payments" ON public.payments FOR DELETE USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((created_by = auth.uid()) OR (created_by IS NULL)))));


--
-- Name: form_responses Admins and masters can delete responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete responses" ON public.form_responses FOR DELETE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: scheduled_activities Admins and masters can delete scheduled activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete scheduled activities" ON public.scheduled_activities FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activity_exclusions Admins and masters can delete scheduled exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete scheduled exclusions" ON public.scheduled_activity_exclusions FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: user_students Admins and masters can delete student links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete student links" ON public.user_students FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: students Admins and masters can delete students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can delete students" ON public.students FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activities Admins and masters can insert activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert activities" ON public.activities FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_donations Admins and masters can insert donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert donations" ON public.activity_donations FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_exclusions Admins and masters can insert exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert exclusions" ON public.activity_exclusions FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: expenses Admins and masters can insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert expenses" ON public.expenses FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: payments Admins and masters can insert payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert payments" ON public.payments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activities Admins and masters can insert scheduled activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert scheduled activities" ON public.scheduled_activities FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activity_exclusions Admins and masters can insert scheduled exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert scheduled exclusions" ON public.scheduled_activity_exclusions FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: user_students Admins and masters can insert student links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert student links" ON public.user_students FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: students Admins and masters can insert students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can insert students" ON public.students FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: form_exclusions Admins and masters can manage form exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can manage form exclusions" ON public.form_exclusions USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: form_fields Admins and masters can manage form fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can manage form fields" ON public.form_fields USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: forms Admins and masters can manage forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can manage forms" ON public.forms USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activities Admins and masters can update activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update activities" ON public.activities FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_donations Admins and masters can update donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update donations" ON public.activity_donations FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_exclusions Admins and masters can update exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update exclusions" ON public.activity_exclusions FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: expenses Admins and masters can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update expenses" ON public.expenses FOR UPDATE USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((created_by = auth.uid()) OR (created_by IS NULL)))));


--
-- Name: payments Admins and masters can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update payments" ON public.payments FOR UPDATE USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((created_by = auth.uid()) OR (created_by IS NULL)))));


--
-- Name: scheduled_activities Admins and masters can update scheduled activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update scheduled activities" ON public.scheduled_activities FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activity_exclusions Admins and masters can update scheduled exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update scheduled exclusions" ON public.scheduled_activity_exclusions FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: students Admins and masters can update students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can update students" ON public.students FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: student_credits Admins and masters can view all credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all credits" ON public.student_credits FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_exclusions Admins and masters can view all exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all exclusions" ON public.activity_exclusions FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: credit_movements Admins and masters can view all movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all movements" ON public.credit_movements FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: payments Admins and masters can view all payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all payments" ON public.payments FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: reimbursements Admins and masters can view all reimbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all reimbursements" ON public.reimbursements FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: form_responses Admins and masters can view all responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all responses" ON public.form_responses FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: user_roles Admins and masters can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activity_exclusions Admins and masters can view all scheduled exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all scheduled exclusions" ON public.scheduled_activity_exclusions FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: user_students Admins and masters can view all student links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view all student links" ON public.user_students FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: activity_donations Admins and masters can view donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view donations" ON public.activity_donations FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: expenses Admins and masters can view expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view expenses" ON public.expenses FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: scheduled_activities Admins and masters can view scheduled activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view scheduled activities" ON public.scheduled_activities FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: students Admins and masters can view students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and masters can view students" ON public.students FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)));


--
-- Name: admin_permissions Admins can view their own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view their own permissions" ON public.admin_permissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activity_donations Alumnos can claim donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can claim donations" ON public.activity_donations FOR UPDATE TO authenticated USING (((student_id IS NULL) AND (donated_at IS NULL) AND public.has_role(auth.uid(), 'alumnos'::public.app_role))) WITH CHECK (((student_id IS NULL) AND (donated_at IS NULL) AND public.has_role(auth.uid(), 'alumnos'::public.app_role)));


--
-- Name: payment_notifications Alumnos can create own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can create own notifications" ON public.payment_notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: activity_donations Alumnos can delete available donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can delete available donations" ON public.activity_donations FOR DELETE USING (((student_id IS NULL) AND (donated_at IS NULL) AND public.has_role(auth.uid(), 'alumnos'::public.app_role)));


--
-- Name: activity_donations Alumnos can insert their own donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can insert their own donations" ON public.activity_donations FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid()))) AND (donated_at IS NULL)));


--
-- Name: dashboard_notifications Alumnos can view active notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view active notifications" ON public.dashboard_notifications FOR SELECT TO authenticated USING (((is_active = true) AND public.has_role(auth.uid(), 'alumnos'::public.app_role)));


--
-- Name: activity_donations Alumnos can view available donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view available donations" ON public.activity_donations FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IS NULL) AND (donated_at IS NULL)));


--
-- Name: payment_notifications Alumnos can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view own notifications" ON public.payment_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: scheduled_activities Alumnos can view scheduled activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view scheduled activities" ON public.scheduled_activities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'alumnos'::public.app_role));


--
-- Name: student_credits Alumnos can view their own credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own credits" ON public.student_credits FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: activity_donations Alumnos can view their own donations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own donations" ON public.activity_donations FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: activity_exclusions Alumnos can view their own exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own exclusions" ON public.activity_exclusions FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: credit_movements Alumnos can view their own movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own movements" ON public.credit_movements FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: payments Alumnos can view their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own payments" ON public.payments FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: scheduled_activity_exclusions Alumnos can view their own scheduled exclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own scheduled exclusions" ON public.scheduled_activity_exclusions FOR SELECT USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (student_id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: students Alumnos can view their own student data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alumnos can view their own student data" ON public.students FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'alumnos'::public.app_role) AND (id IN ( SELECT user_students.student_id
   FROM public.user_students
  WHERE (user_students.user_id = auth.uid())))));


--
-- Name: form_responses Anyone can submit responses to public forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit responses to public forms" ON public.form_responses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.forms
  WHERE ((forms.id = form_responses.form_id) AND (forms.is_active = true) AND ((forms.is_public = true) OR (auth.uid() IS NOT NULL))))));


--
-- Name: forms Anyone can view active public forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active public forms" ON public.forms FOR SELECT USING (((is_active = true) AND (is_public = true)));


--
-- Name: form_fields Anyone can view fields of active public forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view fields of active public forms" ON public.form_fields FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.forms
  WHERE ((forms.id = form_fields.form_id) AND (forms.is_active = true) AND (forms.is_public = true)))));


--
-- Name: activities Authenticated users can view activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view activities" ON public.activities FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: dashboard_notifications Master can manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master can manage notifications" ON public.dashboard_notifications TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: admin_permissions Masters can delete permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can delete permissions" ON public.admin_permissions FOR DELETE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: twilio_accounts Masters can delete twilio accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can delete twilio accounts" ON public.twilio_accounts FOR DELETE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: user_roles Masters can insert any role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can insert any role" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: student_credits Masters can insert credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can insert credits" ON public.student_credits FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: credit_movements Masters can insert movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can insert movements" ON public.credit_movements FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: admin_permissions Masters can insert permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can insert permissions" ON public.admin_permissions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: twilio_accounts Masters can insert twilio accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can insert twilio accounts" ON public.twilio_accounts FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: student_credits Masters can update credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can update credits" ON public.student_credits FOR UPDATE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: twilio_accounts Masters can update twilio accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can update twilio accounts" ON public.twilio_accounts FOR UPDATE USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: admin_permissions Masters can view all permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can view all permissions" ON public.admin_permissions FOR SELECT USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: twilio_accounts Masters can view all twilio accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Masters can view all twilio accounts" ON public.twilio_accounts FOR SELECT USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: payment_notifications Only Master can update notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only Master can update notifications" ON public.payment_notifications FOR UPDATE USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: reimbursements Only masters can delete reimbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only masters can delete reimbursements" ON public.reimbursements FOR DELETE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: user_roles Only masters can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only masters can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: reimbursements Only masters can update reimbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only masters can update reimbursements" ON public.reimbursements FOR UPDATE USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: reimbursements Public can create supplier payment requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can create supplier payment requests" ON public.reimbursements FOR INSERT TO anon WITH CHECK (((type = 'supplier_payment'::public.reimbursement_type) AND (status = 'pending'::public.reimbursement_status) AND (user_id = '00000000-0000-0000-0000-000000000000'::uuid)));


--
-- Name: user_roles Users can create their own alumnos role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own alumnos role" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = 'alumnos'::public.app_role)));


--
-- Name: user_students Users can create their own student link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own student link" ON public.user_students FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_roles Users can update their own first_login; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own first_login" ON public.user_roles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: form_responses Users can view their own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own responses" ON public.form_responses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_students Users can view their own student links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own student links" ON public.user_students FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: twilio_accounts Users can view their own twilio account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own twilio account" ON public.twilio_accounts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_donations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_donations ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_exclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_exclusions ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: form_exclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_exclusions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: form_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: reimbursements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_activity_exclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_activity_exclusions ENABLE ROW LEVEL SECURITY;

--
-- Name: student_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: twilio_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twilio_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_students ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


