// تابع سرور «api» — ثبت سفارش، تأیید پرداخت زرین‌پال (سمت سرور)، ارائه‌ی فصل‌های قفل‌دار.
// در Supabase Dashboard > Edge Functions با نام دقیق «api» بساز و «Verify JWT» را خاموش کن
// (احراز هویت کاربر داخل خود کد با توکن انجام می‌شود).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCHANT = Deno.env.get("ZARINPAL_MERCHANT_ID") ?? "";
const SANDBOX = Deno.env.get("ZARINPAL_SANDBOX") === "true";
const SITE = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
// اگر زرین‌پال درخواست از سرور خارج ایران را نپذیرفت، می‌توان آدرس یک رله را اینجا گذاشت.
const ZP = Deno.env.get("ZARINPAL_API_BASE") ?? (SANDBOX ? "https://sandbox.zarinpal.com/pg/v4/payment" : "https://payment.zarinpal.com/pg/v4/payment");
const PAY = SANDBOX ? "https://sandbox.zarinpal.com/pg/StartPay/" : "https://payment.zarinpal.com/pg/StartPay/";

const sb = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function userFrom(req: Request) {
  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data, error } = await sb.auth.getUser(t);
  return error || !data.user ? null : data.user;
}
async function zp(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${ZP}/${path}.json`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ merchant_id: MERCHANT, ...body }) });
  try { return await r.json(); } catch { return {}; }
}
const setting = async (k: string) => Number((await sb.from("settings").select("value").eq("key", k).single()).data?.value);

// تأیید یک سفارش نزد زرین‌پال و نهایی‌کردن آن؛ مبلغ همیشه از پایگاه داده می‌آید نه از مرورگر.
async function verifyOrder(order: { id: string; amount_rial: number; authority: string | null; status: string }) {
  if (order.status === "paid") return "paid";
  if (!order.authority || order.status !== "pending") return order.status;
  const j = await zp("verify", { amount: order.amount_rial, authority: order.authority });
  const code = j?.data?.code;
  if (code === 100 || code === 101) {
    const { error } = await sb.rpc("finalize_order", { p_order: order.id, p_ref: String(j.data.ref_id ?? "") });
    if (error) throw new Error(error.message);
    return "paid";
  }
  return "unverified";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();
    const user = await userFrom(req);
    if (!user) return json({ error: "ابتدا وارد حساب شو." }, 401);

    if (route === "create-order" && req.method === "POST") {
      if (!MERCHANT) return json({ error: "درگاه پرداخت هنوز تنظیم نشده است." }, 503);
      const { kind, chapter_n } = await req.json();
      let amount: number, n: number | null = null;
      const { data: paidCh } = await sb.from("chapters").select("n").eq("is_free", false);
      const paidNs = (paidCh ?? []).map((c) => c.n);
      const { data: owned } = await sb.from("entitlements").select("chapter_n").eq("user_id", user.id);
      const have = new Set((owned ?? []).map((e) => e.chapter_n));
      if (kind === "chapter") {
        n = Number(chapter_n);
        if (!paidNs.includes(n)) return json({ error: "این فصل قابل خرید نیست." }, 400);
        if (have.has(n)) return json({ error: "این فصل را قبلاً خریده‌ای." }, 409);
        amount = await setting("price_chapter_rial");
      } else if (kind === "bundle") {
        if (paidNs.every((x) => have.has(x))) return json({ error: "همه‌ی فصل‌ها را قبلاً خریده‌ای." }, 409);
        amount = await setting("price_bundle_rial");
      } else return json({ error: "نوع خرید نامعتبر است." }, 400);
      if (!Number.isInteger(amount) || amount <= 0) return json({ error: "قیمت تنظیم نشده است." }, 500);
      const { data: o, error } = await sb.from("orders").insert({ user_id: user.id, kind, chapter_n: n, amount_rial: amount }).select().single();
      if (error) return json({ error: error.message }, 500);
      const j = await zp("request", {
        amount, currency: "IRR", description: kind === "bundle" ? "همه فصل‌های قفل‌دار ریاضی دوم با فیلی" : `فصل ${n} ریاضی دوم با فیلی`,
        callback_url: `${SITE}/pay-callback.html?order=${o.id}`, metadata: { email: user.email },
      });
      if (j?.data?.code === 100 && j.data.authority) {
        await sb.from("orders").update({ authority: j.data.authority }).eq("id", o.id);
        return json({ url: PAY + j.data.authority, order: o.id });
      }
      await sb.from("orders").update({ status: "failed" }).eq("id", o.id);
      return json({ error: "ساخت پرداخت ناموفق بود.", detail: j?.errors ?? null }, 502);
    }

    if (route === "verify" && req.method === "POST") {
      const { order, status } = await req.json();
      const { data: o } = await sb.from("orders").select("id,user_id,amount_rial,authority,status").eq("id", order).single();
      if (!o || o.user_id !== user.id) return json({ error: "سفارش پیدا نشد." }, 404);
      if (status !== "OK" && o.status === "pending") { await sb.from("orders").update({ status: "failed" }).eq("id", o.id); return json({ status: "failed" }); }
      return json({ status: await verifyOrder(o) });
    }

    if (route === "reconcile" && req.method === "POST") {
      // سفارش‌های در انتظار همین کاربر را دوباره نزد زرین‌پال استعلام می‌کند (اگر کاربر بعد از پرداخت صفحه را بسته باشد).
      const since = new Date(Date.now() - 2 * 864e5).toISOString();
      const { data: ps } = await sb.from("orders").select("id,amount_rial,authority,status").eq("user_id", user.id).eq("status", "pending").gte("created_at", since);
      let paid = 0;
      for (const o of ps ?? []) if ((await verifyOrder(o)) === "paid") paid++;
      return json({ paid });
    }

    if (route === "chapter" && req.method === "GET") {
      const n = Number(new URL(req.url).searchParams.get("n"));
      const { data: ch } = await sb.from("chapters").select("n,is_free").eq("n", n).single();
      if (!ch) return json({ error: "فصل پیدا نشد." }, 404);
      const { data: prof } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
      const { data: ent } = await sb.from("entitlements").select("chapter_n").eq("user_id", user.id).eq("chapter_n", n).maybeSingle();
      if (!ch.is_free && !ent && !prof?.is_admin) return json({ error: "این فصل قفل است." }, 403);
      const { data: c } = await sb.from("chapter_content").select("content").eq("n", n).single();
      return c ? json(c.content) : json({ error: "محتوای فصل پیدا نشد." }, 404);
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: "خطای سرور", detail: String(e) }, 500);
  }
});
