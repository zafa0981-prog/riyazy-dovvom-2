// عناصر مشترک: نوار بالا، فوتر، نماد قفل طلایی
const NAV=[['index.html','خانه'],['chapters.html','فصل‌ها'],['ch1.html','آموزش رایگان'],['affiliate.html','همکاری در فروش'],['account.html','حساب من']];
const lockSvg=cl=>`<svg class="${cl||'lockb'}" viewBox="0 0 64 76" aria-hidden="true"><use href="#lock"/></svg>`;
document.addEventListener('DOMContentLoaded',()=>{document.body.insertAdjacentHTML('afterbegin',`<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".45" stop-color="#ffc400"/><stop offset="1" stop-color="#c78a00"/></linearGradient><linearGradient id="gs" x1="0" x2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#d9a000"/><stop offset="1" stop-color="#8f6400"/></linearGradient></defs>
<symbol id="lock" viewBox="0 0 64 76"><path d="M16 36V25a16 16 0 0 1 32 0v11" fill="none" stroke="url(#gs)" stroke-width="9" stroke-linecap="round"/><rect x="5" y="33" width="54" height="40" rx="11" fill="url(#gd)" stroke="#a87100" stroke-width="3"/><ellipse cx="22" cy="42" rx="12" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-8 22 42)"/><circle cx="32" cy="50" r="6" fill="#6b4300"/><rect x="29.5" y="52" width="5" height="12" rx="2.5" fill="#6b4300"/></symbol></svg>`);
const L=document.getElementById('nav');
if(L)L.outerHTML=`<header class="nav"><div class="wrap"><a class="brand" href="index.html"><img src="a/fili2.png" alt="فیلی"><span>ریاضی دوم با فیلی</span></a><nav id="mn">${NAV.map(([h,t])=>`<a href="${h}">${t}</a>`).join('')}</nav><a class="btn3d sm" href="chapters.html">🚀 شروع ماجراجویی</a><button class="burger" aria-label="منو" onclick="document.getElementById('mn').classList.toggle('open')">☰</button></div></header>`;
const F=document.getElementById('ft');
if(F)F.outerHTML=`<footer class="ft"><div class="wrap"><div><b>ریاضی دوم با فیلی</b><br>با فیلی، ریاضی شیرین می‌شه!</div><nav><a href="info.html#about">درباره ما</a><a href="info.html#contact">تماس با ما</a><a href="info.html#terms">قوانین</a><a href="info.html#privacy">حریم خصوصی</a></nav></div></footer>`;
});
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
