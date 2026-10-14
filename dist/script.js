const header=document.querySelector('[data-header]');
const setHeader=()=>header?.classList.toggle('scrolled',scrollY>24);
setHeader();addEventListener('scroll',setHeader,{passive:true});
const reveals=document.querySelectorAll('.reveal');
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});reveals.forEach(el=>observer.observe(el))}else reveals.forEach(el=>el.classList.add('visible'));
document.querySelector('[data-year]').textContent=new Date().getFullYear();
const formTimestamp=document.querySelector('#form-timestamp');
if(formTimestamp)formTimestamp.value=Date.now();
const routeTargets={'/':'top','/expertise':'expertise','/experience':'experience','/work':'work','/pay':'pay','/contact':'contact'};
const normalisePath=path=>path.replace(/\/+$/,'')||'/';
const scrollToRoute=(path,behavior='smooth')=>{const target=document.getElementById(routeTargets[normalisePath(path)]);if(target)target.scrollIntoView({behavior,block:'start'})};
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);const path=normalisePath(url.pathname);if(url.origin===location.origin&&routeTargets[path]){event.preventDefault();history.pushState({},'',path);scrollToRoute(path)}});
addEventListener('popstate',()=>scrollToRoute(location.pathname));
requestAnimationFrame(()=>scrollToRoute(location.pathname,'auto'));
const sent=new URLSearchParams(location.search).get('sent');
const successMessage=document.querySelector('[data-form-success]');
if(sent==='1'&&successMessage){successMessage.hidden=false;successMessage.scrollIntoView({behavior:'smooth',block:'center'});history.replaceState({},'',location.pathname)}
const paymentForm=document.querySelector('[data-payment-form]');
const paymentStatus=document.querySelector('[data-payment-status]');
const checkPaymentStatus=async token=>{const response=await fetch('/api/paynow/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Status check failed.');paymentStatus.textContent=`Payment ${data.status.toLowerCase()}. Reference: ${data.reference}`;if(data.paid)sessionStorage.removeItem('paynow-status-token');return data};
if(paymentForm){
  const methodField=paymentForm.elements.method;
  const phoneWrap=paymentForm.querySelector('[data-phone-field]');
  const phoneField=paymentForm.elements.phone;
  const testNote=paymentForm.querySelector('[data-payment-test-note]');
  const togglePhone=()=>{const mobile=methodField.value==='ecocash'||methodField.value==='onemoney';phoneWrap.hidden=!mobile;phoneField.disabled=!mobile;phoneField.required=mobile};
  methodField.addEventListener('change',togglePhone);togglePhone();
  fetch('/api/paynow/config').then(response=>response.ok?response.json():null).then(config=>{if(config?.mode==='test')testNote.hidden=false}).catch(()=>{});
  paymentForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=paymentForm.querySelector('button[type="submit"]');
    button.disabled=true;button.setAttribute('aria-busy','true');paymentStatus.classList.remove('is-error');paymentStatus.textContent='Connecting securely to Paynow...';
    try{
      const payload=Object.fromEntries(new FormData(paymentForm));
      const response=await fetch('/api/paynow/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Unable to start payment.');
      sessionStorage.setItem('paynow-status-token',data.statusToken);
      if(data.mode==='card'){location.assign(data.redirectUrl);return}
      paymentStatus.textContent=data.instructions;
      let checks=0;
      const poll=async()=>{try{checks+=1;const status=await checkPaymentStatus(data.statusToken);if(!status.paid&&checks<24)setTimeout(poll,5000);else{button.disabled=false;button.removeAttribute('aria-busy')}}catch(error){paymentStatus.textContent=error.message;paymentStatus.classList.add('is-error');button.disabled=false;button.removeAttribute('aria-busy')}};
      setTimeout(poll,5000);
    }catch(error){paymentStatus.textContent=error.message;paymentStatus.classList.add('is-error');button.disabled=false;button.removeAttribute('aria-busy')}
  });
}
if(normalisePath(location.pathname)==='/pay'){const params=new URLSearchParams(location.search);const token=sessionStorage.getItem('paynow-status-token');if(params.has('reference')&&token&&paymentStatus){paymentStatus.textContent='Confirming your payment status...';checkPaymentStatus(token).catch(error=>{paymentStatus.textContent=error.message;paymentStatus.classList.add('is-error')})}}
