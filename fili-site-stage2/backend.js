// اتصال به Supabase. کلید «publishable» عمومی است و گذاشتنش در سایت امن است. کلید service_role را هرگز اینجا نگذار.
const BACKEND={url:'https://tnxzftyywdnsvemhhfqq.supabase.co',key:'sb_publishable_eCjEjsiqlr-Ug9nye4AwkA_GiXCrxpG'};
const API=BACKEND.url+'/functions/v1/api';
const sb=window.supabase.createClient(BACKEND.url,BACKEND.key);
(()=>{const r=new URLSearchParams(location.search).get('ref');if(r)localStorage.setItem('fili_ref',r.toLowerCase())})();
const money=r=>fa(Math.round(r/10).toLocaleString('en-US')).replace(/,/g,'٬')+' تومان';
async function session(){const{data}=await sb.auth.getSession();return data.session}
async function requireLogin(){const s=await session();if(!s){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.search));return new Promise(()=>{})}return s}
async function api(path,opts={}){const s=await session();const r=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.access_token}:{})}});let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw Object.assign(new Error(j.error||'خطا در ارتباط با سرور'),{status:r.status,body:j});return j}
async function claimRef(){const c=localStorage.getItem('fili_ref');if(c){try{await sb.rpc('claim_referral',{p_code:c})}catch(e){}localStorage.removeItem('fili_ref')}}
async function myEntitlements(){const s=await session();if(!s)return new Set();const{data}=await sb.from('entitlements').select('chapter_n');return new Set((data||[]).map(x=>x.chapter_n))}
const faErr=m=>({'Invalid login credentials':'ایمیل یا رمز عبور درست نیست.','User already registered':'با این ایمیل قبلاً ثبت‌نام شده است.','Email not confirmed':'ایمیلت هنوز تأیید نشده است؛ صندوق ایمیل را ببین.'}[m]||(/at least 6/.test(m)?'رمز عبور باید دست‌کم ۶ نویسه باشد.':/rate limit/i.test(m)?'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کن.':m));
