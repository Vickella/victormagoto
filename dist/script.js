const header=document.querySelector('[data-header]');
const setHeader=()=>header?.classList.toggle('scrolled',scrollY>24);
setHeader();addEventListener('scroll',setHeader,{passive:true});
const reveals=document.querySelectorAll('.reveal');
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});reveals.forEach(el=>observer.observe(el))}else reveals.forEach(el=>el.classList.add('visible'));
document.querySelector('[data-year]').textContent=new Date().getFullYear();
const formTimestamp=document.querySelector('#form-timestamp');
if(formTimestamp)formTimestamp.value=Date.now();
const sent=new URLSearchParams(location.search).get('sent');
const successMessage=document.querySelector('[data-form-success]');
if(sent==='1'&&successMessage){successMessage.hidden=false;successMessage.scrollIntoView({behavior:'smooth',block:'center'});history.replaceState({},'',`${location.pathname}#contact`)}
