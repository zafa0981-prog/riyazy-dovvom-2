// نقطهٔ کنترل دسترسی (مرحلهٔ ۱: فقط براساس رایگان‌بودن فصل در config.js).
// هشدار: این تابع فقط برای نمایش رابط کاربری است؛ امنیت واقعی با مخفی‌کردن دکمه ایجاد نمی‌شود.
// در مرحلهٔ بعد، محتوای فصل‌های ۳ تا ۸ باید از سرور (Supabase) و فقط پس از بررسی خریدِ کاربر ارائه شود.
// تا آن زمان فایل‌های این فصل‌ها اصلاً در سایت عمومی گذاشته نمی‌شوند.
function chapterAccess(n){const c=CHAPTERS.find(x=>x.n===n);if(!c)return{ok:false,reason:'missing'};
 return c.free?{ok:true}:{ok:false,reason:'locked'}}
function chapterUrl(n){return chapterAccess(n).ok?'ch'+n+'.html':'buy.html?ch='+n}
