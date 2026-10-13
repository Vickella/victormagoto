const header=document.querySelector('[data-header]');
const setHeader=()=>header?.classList.toggle('scrolled',scrollY>24);
setHeader();addEventListener('scroll',setHeader,{passive:true});
const reveals=document.querySelectorAll('.reveal');
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});reveals.forEach(el=>observer.observe(el))}else reveals.forEach(el=>el.classList.add('visible'));
document.querySelector('[data-year]').textContent=new Date().getFullYear();
const formTimestamp=document.querySelector('#form-timestamp');
if(formTimestamp)formTimestamp.value=Date.now();
const routeTargets={'/':'top','/expertise':'expertise','/experience':'experience','/work':'work','/contact':'contact'};
const normalisePath=path=>path.replace(/\/+$/,'')||'/';
const scrollToRoute=(path,behavior='smooth')=>{const target=document.getElementById(routeTargets[normalisePath(path)]);if(target)target.scrollIntoView({behavior,block:'start'})};
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);const path=normalisePath(url.pathname);if(url.origin===location.origin&&routeTargets[path]){event.preventDefault();history.pushState({},'',path);scrollToRoute(path)}});
addEventListener('popstate',()=>scrollToRoute(location.pathname));
requestAnimationFrame(()=>scrollToRoute(location.pathname,'auto'));
const sent=new URLSearchParams(location.search).get('sent');
const successMessage=document.querySelector('[data-form-success]');
if(sent==='1'&&successMessage){successMessage.hidden=false;successMessage.scrollIntoView({behavior:'smooth',block:'center'});history.replaceState({},'',location.pathname)}
