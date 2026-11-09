// موتور هر فصل: درس‌ها، تمرین‌های تصادفی، ناوبری
const L=CH.lessons;let li=0,qi=-1,tm,wrong=0;const Q=[],done=new Set(),card=$('#st');
document.body.classList.add('b'+CH.bg);
$('#ttl').textContent='فصل '+fa(CH.id)+' · '+CH.title;
const chips=$('#chips');L.forEach((l,i)=>{const b=E('button',l[0],'chip');b.onclick=()=>go(i,-1);chips.append(b)});
function mkQ(i){if(!Q[i])Q[i]=L[i][2].map(([t,p])=>T[t](p||{}));return Q[i]}
function go(i,j){clearTimeout(tm);li=i;qi=j;wrong=0;sfx.pop();show()}
function upd(){[...chips.children].forEach((c,i)=>{c.classList.toggle('on',i==li);c.classList.toggle('dn',done.has(i))});const tot=L.length*5,cur=[...done].length*5+(qi>=0?qi:0);$('#pb').style.width=Math.min(100,cur/tot*100)+'%';$('#prev').disabled=li==0&&qi<=0;chips.children[li]?.scrollIntoView({block:'nearest',inline:'center'})}
function show(){if(li>=L.length)return fin();upd();card.innerHTML='';const l=L[li];if(qi<0)return intro(l);const qs=mkQ(li),q=qs[qi];
 card.append(E('div',`درس ${fa(li+1)}: ${l[0]} · تمرین ${fa(qi+1)} از ${fa(qs.length)}`,'lt'),E('h2',q.q));const v=E('div','','vis'),c=E('div','','ch'),m=E('div','','msg');card.append(v,c,m);
 typeof q.vis=='function'?q.vis(v):v.innerHTML=q.vis||'';
 const ok=()=>{sfx.ok();m.className='msg ok';m.textContent=pick(['آفرین! درست بود!','عالی بود!','ایول! جواب درست!','خیلی خوب!']);q.rev&&q.rev(v);stars();nextBtn(c)};
 if(q.run){q.run(v,ok,()=>{sfx.no();m.className='msg hint';m.textContent=q.hint})}
 else q.opts.forEach(o=>{const b=E('button',o.h);if(o.cim)b.className='cim';b.onclick=()=>{if(c.classList.contains('fin'))return;if(String(o.v)===String(q.ans)){c.classList.add('fin');b.classList.add('good');c.querySelectorAll('button').forEach(x=>x.disabled=true);ok()}else{b.classList.add('bad');b.disabled=true;sfx.no();m.className='msg hint';m.textContent=++wrong>1?q.hint:'اشکال نداره، دوباره فکر کن.'}};c.append(b)})}
function nextBtn(c){const b=E('button','ادامه ◀','btn');b.onclick=nx;c.after(b);tm=setTimeout(nx,4200)}
function nx(){clearTimeout(tm);wrong=0;const n=mkQ(li).length;if(qi+1<n)qi++;else{done.add(li);li++;qi=-1}show()}
$('#prev').onclick=()=>{clearTimeout(tm);wrong=0;sfx.pop();if(qi>0)qi--;else if(li>0){li--;qi=mkQ(li).length-1}show()};
function intro(l){card.append(E('div',`درس ${fa(li+1)} از ${fa(L.length)}`,'lt'),E('h2',l[0]),E('p',l[1],'msg'));const d=T[l[2][0][0]](l[2][0][1]||{});if(!d.run){card.append(E('h2','نگاه کن، این‌طور حل می‌شود:'));const v=E('div','','vis');card.append(E('div',d.q,'msg'),v);typeof d.vis=='function'?d.vis(v):v.innerHTML=d.vis||'';tm=setTimeout(()=>{d.rev&&d.rev(v)},900)}
 const b=E('button','شروع تمرین ▶','btn');b.onclick=()=>go(li,0);card.append(b)}
function stars(){for(let k=0;k<14;k++){const c=E('div',pick(['⭐','✨','🎈','🎉']),'conf');c.style.left=Math.random()*100+'vw';document.body.append(c);requestAnimationFrame(()=>c.style.transform=`translateY(110vh) rotate(${Math.random()*540}deg)`);setTimeout(()=>c.remove(),3200)}}
function fin(){clearTimeout(tm);upd();$('#pb').style.width='100%';chips.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));sfx.win();for(let i=0;i<3;i++)setTimeout(stars,i*500);card.innerHTML=`<img class="cert" src="a/cert.jpg" alt="گواهی قهرمانی">`;const w=E('div','','ch');const r=E('button','دوباره تمرین کن 🔁','btn');r.onclick=()=>{Q.length=0;done.clear();go(0,-1)};const h=E('a','🏠 بازگشت به صفحه فصل‌ها','tb home');h.href='chapters.html';w.append(r,h);card.append(w)}
$('#tm').onclick=function(){music(!mus);this.style.opacity=mus?1:.45};$('#tm').style.opacity=.45;
$('#tv').onclick=function(){sfxOn=!sfxOn;this.style.opacity=sfxOn?1:.45};
document.addEventListener('pointerdown',()=>{if(!window._m){window._m=1;music(true);$('#tm').style.opacity=1}},{once:true});
show();
