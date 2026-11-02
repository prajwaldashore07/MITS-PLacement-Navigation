import { api, setCsrfToken } from './api.js';
import { renderShell, bindShell } from './components/layout.js';
import { showToast, icon, esc } from './components/ui.js';
import { loginView } from './views/login.js';
import { interestsView, skillsView, resumeView } from './views/onboarding.js';
import { dashboardView } from './views/dashboard.js';
import { companiesView, companyDetailsView } from './views/companies.js';
import { applicationsView } from './views/applications.js';
import { preparationView, testView, resultsView } from './views/preparation.js';
import { learningView } from './views/learning.js';
import { profileView } from './views/profile.js';
import { adminView, adminForbiddenView } from './views/admin.js';

let session=null;
let sessionLoaded=false;
let cleanup=null;
let rendering=false;

function pathForStudent(student){
  if(student?.onboarding_step==='complete')return '/dashboard';
  const allowed=['interests','skills','resume'];
  return `/onboarding/${allowed.includes(student?.onboarding_step)?student.onboarding_step:'interests'}`;
}

const ctx={
  get session(){return session;},
  get path(){return location.pathname;},
  navigate(path,replace=false){
    if(cleanup){cleanup();cleanup=null;}
    if(replace)history.replaceState({},'',path);else history.pushState({},'',path);
    queueMicrotask(()=>render());
  },
  setSession(data){
    session=data?.authenticated?data:null;
    sessionLoaded=true;
    setCsrfToken(session?.csrfToken||'');
  },
  async refreshSession(){
    const data=await api('/api/session');
    this.setSession(data);
    return session;
  },
  pathForStudent,
  setCleanup(fn){cleanup=fn;},
  toast:showToast,
};

async function mountShell(view,{title,active,role='student'}={}){
  const root=document.querySelector('#app');
  const nodes=[...root.childNodes];
  root.innerHTML=renderShell('',{title,active,role,session});
  const target=root.querySelector('#page-content');
  for(const node of nodes)target.appendChild(node);
  bindShell({onLogout:async()=>{
    try{await api('/api/auth/logout',{method:'DELETE',body:{}});}catch(error){showToast(error.message,'error');return;}
    session=null;sessionLoaded=true;setCsrfToken('');ctx.navigate('/');
  }});
}

function bindRouteLinks(){
  document.addEventListener('click',(event)=>{
    const anchor=event.target.closest('a[data-route]');
    if(!anchor)return;
    event.preventDefault();
    const target=anchor.getAttribute('data-route')||anchor.getAttribute('href');
    if(target)ctx.navigate(target);
  });
}

async function render(){
  if(rendering)return;
  rendering=true;
  try{
    if(!sessionLoaded){
      try{await ctx.refreshSession();}
      catch(error){session=null;sessionLoaded=true;setCsrfToken('');}
    }
    const path=location.pathname;
    if(path==='/admin/login'){
      if(session?.role==='admin'){ctx.navigate('/admin',true);return;}
      if(session?.role==='student'){adminForbiddenView();return;}
      await loginView(ctx,{admin:true});return;
    }
    if(path.startsWith('/admin')){
      if(!session){history.replaceState({},'','/admin/login');await loginView(ctx,{admin:true});return;}
      if(session.role!=='admin'){adminForbiddenView();return;}
      const adminTitle=path==='/admin'||path==='/admin/'?'Admin overview':path.split('/').filter(Boolean).at(-1).replace(/-/g,' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
      await adminView(ctx,path);
      await mountShell(null,{title:adminTitle,active:path==='/admin'?'/admin':`/admin/${path.split('/').filter(Boolean).at(-1)}`,role:'admin'});
      return;
    }
    if(!session){if(path!=='/'){history.replaceState({},'','/');}await loginView(ctx);return;}
    if(session.role==='admin'){
      if(path==='/'){ctx.navigate('/admin',true);return;}
      adminForbiddenView();return;
    }
    if(path==='/'){
      ctx.navigate(pathForStudent(session.student),true);return;
    }
    if(path==='/dashboard'&&session.student?.onboarding_step!=='complete'){
      ctx.navigate(pathForStudent(session.student),true);return;
    }
    if(path==='/onboarding/interests'){await interestsView(ctx);return;}
    if(path==='/onboarding/skills'){await skillsView(ctx);return;}
    if(path==='/onboarding/resume'){await resumeView(ctx);return;}
    let view;let title;let active;
    if(path==='/dashboard'){view=()=>dashboardView(ctx);title='Dashboard';active='/dashboard';}
    else if(path==='/companies'){view=()=>companiesView(ctx);title='Eligible companies';active='/companies';}
    else if(/^\/companies\/\d+$/.test(path)){view=()=>companyDetailsView(ctx,path.split('/').at(-1));title='Opportunity details';active='/companies';}
    else if(path==='/applications'){view=()=>applicationsView(ctx);title='My applications';active='/applications';}
    else if(path==='/preparation'){view=()=>preparationView(ctx);title='Company preparation';active='/preparation';}
    else if(/^\/tests\/\d+$/.test(path)){view=()=>testView(ctx,path.split('/').at(-1));title='Mock test';active='/preparation';}
    else if(/^\/attempts\/\d+\/results$/.test(path)){view=()=>resultsView(ctx,path.split('/')[2]);title='Test results';active='/preparation';}
    else if(path==='/learning'){view=()=>learningView(ctx);title='Skills & learning';active='/learning';}
    else if(path==='/profile'){view=()=>profileView(ctx);title='My profile';active='/profile';}
    else{document.querySelector('#app').innerHTML=`<div class="page-heading"><div><div class="eyebrow">Not found</div><h1>This page is not in your workspace.</h1><p>Use the navigation to return to a student feature.</p></div><a class="btn" href="/dashboard" data-route="/dashboard">${icon('back',15)} Dashboard</a></div>`;await mountShell(null,{title:'Page not found',active:''});return;}
    await view();
    await mountShell(null,{title,active,role:'student'});
  }catch(error){
    const root=document.querySelector('#app');
    root.innerHTML=`<main class="login-page"><section class="login-card"><div class="login-brand"><span class="brand-mark">${icon('warning',20)}</span><div><strong>We couldn’t load this page</strong><small>${esc(error.message||'Please refresh and try again.')}</small></div></div><button class="btn" type="button" id="retry-page">Try again</button></section></main>`;
    root.querySelector('#retry-page')?.addEventListener('click',()=>render());
  }finally{rendering=false;}
}

bindRouteLinks();
window.addEventListener('popstate',()=>{if(cleanup){cleanup();cleanup=null;}render();});
window.addEventListener('storage',()=>{});
render();
