-- ========== «ریاضی دوم با فیلی» — راه‌اندازی پایگاه داده (Supabase SQL Editor) ==========
-- مبالغ همه‌جا «ریال» و عدد صحیح هستند. اجرای دوباره‌ی کل فایل روی پایگاه خالی بی‌خطر است.
create extension if not exists pgcrypto;

create table if not exists public.settings(key text primary key, value text not null);
insert into public.settings(key,value) values ('commission_rate','0.20'),('price_chapter_rial','10000'),('price_bundle_rial','50000') on conflict do nothing;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text,
  referral_code text unique not null default substr(replace(gen_random_uuid()::text,'-',''),1,8),
  referred_by uuid references public.profiles(id),
  is_admin boolean not null default false,
  created_at timestamptz not null default now());

create table if not exists public.chapters(n int primary key, title text not null, is_free boolean not null default false);
insert into public.chapters(n,title,is_free) values
 (1,'عدد و شمارش',true),(2,'جمع و تفریق',true),(3,'شکل‌های هندسی و تقارن',false),(4,'پول و عددهای سه‌رقمی',false),
 (5,'اندازه‌گیری طول',false),(6,'جمع و تفریق اعداد سه‌رقمی',false),(7,'کسر و احتمال',false),(8,'سرشماری و نمایش داده‌ها',false) on conflict do nothing;
-- محتوای فصل‌های قفل‌دار؛ هیچ سیاست RLS ندارد، یعنی فقط سرور (service role) می‌تواند بخواند.
create table if not exists public.chapter_content(n int primary key references public.chapters(n), content jsonb not null);

create table if not exists public.orders(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('chapter','bundle')),
  chapter_n int references public.chapters(n),
  amount_rial bigint not null check (amount_rial>0),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  authority text unique, ref_id text,
  created_at timestamptz not null default now(), paid_at timestamptz,
  check ((kind='chapter' and chapter_n is not null) or (kind='bundle' and chapter_n is null)));

create table if not exists public.entitlements(
  user_id uuid not null references public.profiles(id), chapter_n int not null references public.chapters(n),
  order_id uuid references public.orders(id), granted_at timestamptz not null default now(),
  primary key(user_id,chapter_n));   -- دسترسی دائمی، بدون تاریخ انقضا

create table if not exists public.commissions(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  affiliate_id uuid not null references public.profiles(id),
  rate numeric not null, base_rial bigint not null, amount_rial bigint not null,
  status text not null default 'wallet' check (status in ('wallet','reversed')),
  created_at timestamptz not null default now());

create table if not exists public.wallet_ledger(
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id),
  commission_id uuid references public.commissions(id),
  delta_rial bigint not null,
  idempotency_key text not null unique, note text,
  created_at timestamptz not null default now());

create table if not exists public.payouts(
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id),
  amount_rial bigint not null check (amount_rial>0), note text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now());

-- ===== پروفایل خودکار هنگام ثبت‌نام =====
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id,new.email,new.raw_user_meta_data->>'full_name') on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== توابع کمکی =====
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select is_admin from public.profiles where id=auth.uid()),false) $$;

create or replace function public.claim_referral(p_code text) returns boolean language plpgsql security definer set search_path=public as $$
declare aff uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into aff from profiles where referral_code=lower(trim(p_code));
  if aff is null or aff=auth.uid() then return false; end if;
  if exists(select 1 from orders where user_id=auth.uid() and status='paid') then return false; end if;
  update profiles set referred_by=aff where id=auth.uid() and referred_by is null;
  return found;
end $$;

create or replace function public.my_balance() returns bigint language sql stable security definer set search_path=public as
$$ select coalesce(sum(delta_rial),0)::bigint from wallet_ledger where affiliate_id=auth.uid() $$;

-- نهایی‌کردن پرداخت: اتمیک و تکرارپذیر (دوبار صدا زدن، دو بار پورسانت نمی‌دهد). فقط سرور صدایش می‌زند.
create or replace function public.finalize_order(p_order uuid, p_ref text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; aff uuid; rate numeric; amt bigint; cid uuid;
begin
  update orders set status='paid', ref_id=p_ref, paid_at=now() where id=p_order and status='pending' returning * into o;
  if not found then return jsonb_build_object('already',true); end if;
  if o.kind='chapter' then
    insert into entitlements(user_id,chapter_n,order_id) values (o.user_id,o.chapter_n,o.id) on conflict do nothing;
  else
    insert into entitlements(user_id,chapter_n,order_id) select o.user_id,n,o.id from chapters where not is_free on conflict do nothing;
  end if;
  select referred_by into aff from profiles where id=o.user_id;
  if aff is not null and aff<>o.user_id then
    select value::numeric into rate from settings where key='commission_rate';
    amt := floor(o.amount_rial*rate);
    if amt>0 then
      insert into commissions(order_id,affiliate_id,rate,base_rial,amount_rial) values (o.id,aff,rate,o.amount_rial,amt)
        on conflict (order_id) do nothing returning id into cid;
      if cid is not null then
        insert into wallet_ledger(affiliate_id,commission_id,delta_rial,idempotency_key,note) values (aff,cid,amt,'commission:'||o.id,'پورسانت خرید') on conflict do nothing;
      end if;
    end if;
  end if;
  return jsonb_build_object('paid',true);
end $$;

-- برگشت خرید (فقط مدیر): دسترسی‌ها حذف و پورسانت برگشت می‌خورد. بازگرداندن پول واقعی را باید در پنل زرین‌پال انجام دهی.
create or replace function public.reverse_order(p_order uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; c public.commissions;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update orders set status='refunded' where id=p_order and status='paid' returning * into o;
  if not found then return jsonb_build_object('ok',false); end if;
  delete from entitlements where order_id=o.id;
  select * into c from commissions where order_id=o.id and status='wallet';
  if found then
    update commissions set status='reversed' where id=c.id;
    insert into wallet_ledger(affiliate_id,commission_id,delta_rial,idempotency_key,note) values (c.affiliate_id,c.id,-c.amount_rial,'reverse:'||o.id,'برگشت پورسانت') on conflict do nothing;
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- ثبت واریز دستی پورسانت (فقط مدیر)
create or replace function public.admin_record_payout(p_aff uuid, p_amount bigint, p_note text) returns jsonb language plpgsql security definer set search_path=public as $$
declare bal bigint; pid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select coalesce(sum(delta_rial),0) into bal from wallet_ledger where affiliate_id=p_aff;
  if p_amount<=0 or p_amount>bal then return jsonb_build_object('ok',false,'balance',bal); end if;
  insert into payouts(affiliate_id,amount_rial,note,created_by) values (p_aff,p_amount,p_note,auth.uid()) returning id into pid;
  insert into wallet_ledger(affiliate_id,delta_rial,idempotency_key,note) values (p_aff,-p_amount,'payout:'||pid,coalesce(p_note,'واریز پورسانت'));
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.finalize_order(uuid,text) from public,anon,authenticated;
revoke all on function public.reverse_order(uuid) from public,anon;
revoke all on function public.admin_record_payout(uuid,bigint,text) from public,anon;
revoke all on function public.claim_referral(text) from public,anon;
revoke all on function public.my_balance() from public,anon;
grant execute on function public.reverse_order(uuid), public.admin_record_payout(uuid,bigint,text), public.claim_referral(text), public.my_balance() to authenticated;

-- ===== امنیت سطح ردیف (RLS) =====
alter table public.settings enable row level security;        create policy settings_read on public.settings for select using (true);
alter table public.chapters enable row level security;        create policy chapters_read on public.chapters for select using (true);
alter table public.chapter_content enable row level security; -- بدون سیاست: فقط service role
alter table public.profiles enable row level security;        create policy profiles_own on public.profiles for select using (id=auth.uid() or public.is_admin());
alter table public.orders enable row level security;          create policy orders_own on public.orders for select using (user_id=auth.uid() or public.is_admin());
alter table public.entitlements enable row level security;    create policy ent_own on public.entitlements for select using (user_id=auth.uid() or public.is_admin());
alter table public.commissions enable row level security;     create policy com_own on public.commissions for select using (affiliate_id=auth.uid() or public.is_admin());
alter table public.wallet_ledger enable row level security;   create policy led_own on public.wallet_ledger for select using (affiliate_id=auth.uid() or public.is_admin());
alter table public.payouts enable row level security;         create policy pay_own on public.payouts for select using (affiliate_id=auth.uid() or public.is_admin());
-- هیچ سیاست نوشتن (insert/update/delete) برای کاربران وجود ندارد: همه‌ی تغییرات فقط از طریق سرور و توابع بالا.
