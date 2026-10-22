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

// Ensure the official Facebook link is available in the footer on every page.
(()=>{
const footer=document.querySelector('.footer');
if(!footer||footer.querySelector('.tieks-facebook'))return;
const email=[...footer.querySelectorAll('a[href^="mailto:"]')].pop();
if(!email)return;
const a=document.createElement('a');
a.className='tieks-facebook';
a.href='https://www.facebook.com/share/1HnfHLcHRz/?mibextid=wwXIfr';
a.target='_blank';
a.rel='noopener noreferrer';
a.setAttribute('aria-label','Tieks Tweewielers op Facebook');
a.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.88h-2.33v6.99A10 10 0 0 0 22 12Z"/></svg> Facebook';
email.insertAdjacentElement('afterend',a);
})();


// Klein Facebook-icoon in de bovenste balk, op iedere pagina.
(()=>{
const topbar=document.querySelector('.topline .container');
if(!topbar||topbar.querySelector('.tieks-facebook-top'))return;
const icon=document.createElement('a');
icon.className='tieks-facebook-top';
icon.href='https://www.facebook.com/share/1HnfHLcHRz/?mibextid=wwXIfr';
icon.target='_blank';
icon.rel='noopener noreferrer';
icon.setAttribute('aria-label','Tieks Tweewielers op Facebook (opent in nieuw tabblad)');
icon.setAttribute('title','Tieks op Facebook');
icon.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.88h-2.33v6.99A10 10 0 0 0 22 12Z"/></svg>';
topbar.appendChild(icon);
})();
