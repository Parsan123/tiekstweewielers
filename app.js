const burger=document.querySelector('.burger'),menu=document.querySelector('.mobile-menu');
burger?.addEventListener('click',()=>{menu?.classList.toggle('open');burger.setAttribute('aria-expanded',menu?.classList.contains('open')?'true':'false')});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>menu?.classList.remove('open')));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  const f=b.dataset.filter;
  document.querySelectorAll('[data-product]').forEach(c=>{
    const tags=(c.dataset.product||'').split('|');c.classList.toggle('hide',f!=='all'&&!tags.includes(f));
  });
}));
const status=document.querySelector('[data-open-status]');
if(status){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const g=t=>parts.find(x=>x.type===t)?.value;const d=g('weekday'),m=+g('hour')*60 + +g('minute');const hrs={Tue:[510,1080],Wed:[510,1080],Thu:[510,1080],Fri:[510,1080],Sat:[510,1020]};const h=hrs[d];status.textContent=h&&m>=h[0]&&m<h[1]?'Nu geopend':'Nu gesloten';}


// Winterbeurtactie: alleen zichtbaar van 1 oktober t/m de laatste dag van februari.
// De maand wordt expliciet in de Nederlandse tijdzone bepaald.
// Let op: bevestig de tarieven bij Tieks vóór de actie van een volgend seizoen.
(()=>{
 const promos=document.querySelectorAll('[data-seasonal-promo]');
 if(!promos.length)return;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',month:'numeric'}).formatToParts(new Date());
 const month=Number(parts.find(part=>part.type==='month')?.value);
 const active=Number.isInteger(month)&&(month>=10||month<=2);
 promos.forEach(promo=>{promo.hidden=!active;});
})();
