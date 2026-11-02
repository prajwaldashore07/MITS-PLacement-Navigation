const iconPaths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  user:'<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart:'<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
  back:'<path d="M19 12H5m7 7-7-7 7-7"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m18 6-12 12M6 6l12 12"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  spark:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
  shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  external:'<path d="M14 3h7v7m-1-6-9 9"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  compass:'<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  filter:'<path d="M4 7h16M7 12h10m-7 5h4"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  warning:'<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
};
export function icon(name,size=18){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.spark}</svg>`;}
export function brandMark(){return `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="23" height="23" fill="none"><path d="M5 23V8l11 9 11-9v15M10 23V15m12 8v-8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="5" r="2.5" fill="#BFD0FF"/></svg></span>`;}
export function esc(value=''){return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function initials(name='Student'){return String(name).trim().split(/\s+/).slice(0,2).map((part)=>part[0]||'').join('').toUpperCase();}
export function dateLabel(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric'}).format(d);}
export function relativeDeadline(value){const d=new Date(`${String(value).slice(0,10)}T23:59:59`);if(Number.isNaN(d.getTime()))return 'Deadline not set';const days=Math.ceil((d-new Date())/86400000);if(days<0)return 'Deadline passed';if(days===0)return 'Closes today';if(days===1)return '1 day left';return `${days} days left`;}
export function lpa(value){return `₹${Number(value||0).toFixed(Number(value)%1?1:0)} LPA`;}
export function statusClass(status=''){return String(status).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function badge(status){return `<span class="badge ${statusClass(status)}">${esc(status)}</span>`;}
export function button(label,{variant='primary',route='',action='',iconName='',disabled=false,className=''}={}){const tag=route?'a':'button';const attrs=route?`href="${esc(route)}" data-route="${esc(route)}"`:`type="button"${action?` data-action="${esc(action)}"`:''}`;return `<${tag} class="btn ${variant==='primary'?'':variant} ${className}" ${attrs} ${disabled?'disabled':''}>${iconName?icon(iconName,15):''}${esc(label)}</${tag}>`;}
export function emptyState(title,description,{iconName='spark',actionHtml=''}={}){return `<div class="empty-state"><span class="empty-icon">${icon(iconName,20)}</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${actionHtml}</div>`;}
export function showToast(message,type='info'){let region=document.querySelector('.toast-region');if(!region){region=document.createElement('div');region.className='toast-region';region.setAttribute('aria-live','polite');document.body.append(region);}const item=document.createElement('div');item.className=`toast ${type}`;item.textContent=message;region.append(item);setTimeout(()=>item.remove(),4200);}
export function openModal({title,body,actions='',label='Dialog'}){closeModal();const wrapper=document.createElement('div');wrapper.className='modal-backdrop';wrapper.setAttribute('role','presentation');wrapper.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="${esc(label||title)}"><div class="modal-header"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close-modal aria-label="Close">${icon('close',16)}</button></div><div class="modal-body">${body}</div>${actions?`<div class="row" style="justify-content:flex-end;margin-top:22px">${actions}</div>`:''}</section>`;wrapper.addEventListener('click',(event)=>{if(event.target===wrapper||event.target.closest('[data-close-modal]'))closeModal();});document.body.append(wrapper);wrapper.querySelector('button')?.focus();document.addEventListener('keydown',modalEscape,{once:true});return wrapper;}
function modalEscape(event){if(event.key==='Escape')closeModal();}
export function closeModal(){document.querySelector('.modal-backdrop')?.remove();}
export function confirmAction({title,message,confirmLabel='Confirm',danger=false}={}){return new Promise((resolve)=>{const wrapper=openModal({title,body:`<p class="muted" style="margin:0">${esc(message)}</p>`,actions:`<button type="button" class="btn secondary" data-cancel>Cancel</button><button type="button" class="btn ${danger?'danger':''}" data-confirm>${esc(confirmLabel)}</button>`});wrapper.querySelector('[data-cancel]').addEventListener('click',()=>{closeModal();resolve(false);});wrapper.querySelector('[data-confirm]').addEventListener('click',()=>{closeModal();resolve(true);});wrapper.addEventListener('click',(event)=>{if(event.target===wrapper)resolve(false);},{once:true});});}
export function demoNotice(text='Fictional demonstration data. This platform does not submit applications to employers.'){return `<div class="callout" role="note">${icon('shield',18)}<p>${esc(text)}</p></div>`;}
export function percentBar(value,{tone=''}={}){const amount=Math.max(0,Math.min(100,Number(value)||0));return `<div class="progress-track" role="progressbar" aria-valuenow="${amount}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${tone}" style="width:${amount}%"></div></div>`;}
