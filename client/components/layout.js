import { brandMark, esc, icon, initials } from './ui.js';

const studentNav=[
  {label:'Overview',path:'/dashboard',icon:'grid'},
  {label:'Eligible companies',path:'/companies',icon:'briefcase'},
  {label:'My applications',path:'/applications',icon:'file'},
  {label:'Company preparation',path:'/preparation',icon:'target'},
  {label:'Skills & learning',path:'/learning',icon:'book'},
  {label:'My profile',path:'/profile',icon:'user'},
];
const adminNav=[
  {label:'Admin overview',path:'/admin',icon:'grid'},
  {label:'Students',path:'/admin/students',icon:'users'},
  {label:'Opportunities',path:'/admin/opportunities',icon:'briefcase'},
  {label:'Applications',path:'/admin/applications',icon:'file'},
  {label:'Mock tests',path:'/admin/tests',icon:'chart'},
  {label:'Learning hub',path:'/admin/learning',icon:'book'},
];
export function renderShell(content,{title='Dashboard',active='',role='student',session={}}={}){
  const isAdmin=role==='admin';const nav=isAdmin?adminNav:studentNav;
  const displayName=isAdmin?session.admin?.full_name:session.student?.full_name;
  const caption=isAdmin?'Administrator':`${session.student?.branch||'Student'} · ${session.student?.batch||''}`;
  const path=location.pathname;
  const links=nav.map((item)=>{const selected=active===item.path||(item.path!=='/dashboard'&&path.startsWith(item.path)&&active===item.path);return `<a class="nav-link ${selected?'active':''}" href="${item.path}" data-route="${item.path}" ${selected?'aria-current="page"':''}>${icon(item.icon,17)}<span>${item.label}</span></a>`;}).join('');
  return `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand">${brandMark()}<div><div class="brand-name">MITS Placement</div><div class="brand-caption">Navigation platform</div></div></div><div class="sidebar-section">${isAdmin?'Administration':'Workspace'}</div><nav class="nav-list" aria-label="${isAdmin?'Administrator':'Student'} navigation">${links}</nav><div class="sidebar-footer">${isAdmin?'Protected management workspace. Changes are recorded in the audit history.':'Fictional student and opportunity data for demonstration only.'}</div></aside><div class="sidebar-backdrop" data-action="close-nav"></div><div class="workspace"><header class="topbar"><div class="topbar-left"><button class="mobile-menu" type="button" data-action="toggle-nav" aria-label="Open navigation">${icon('menu',20)}</button><span class="topbar-title">${esc(title)}</span></div><div class="topbar-right"><div class="dropdown"><button class="account-button" type="button" data-action="account-menu" aria-haspopup="true" aria-expanded="false"><span class="profile-avatar">${esc(initials(displayName))}</span><span class="account-name"><strong>${esc(displayName||'Account')}</strong><small>${esc(caption)}</small></span></button><div class="account-menu" role="menu"><a role="menuitem" href="${isAdmin?'/admin':'/profile'}" data-route="${isAdmin?'/admin':'/profile'}">${isAdmin?'Admin overview':'My profile'}</a><button type="button" data-action="logout" role="menuitem">${icon('logout',14)} Sign out</button></div></div></div></header><main class="content" id="page-content">${content}</main></div></div><div class="toast-region" aria-live="polite"></div>`;
}
export function bindShell({onLogout}){
  const sidebar=document.querySelector('#sidebar');
  document.querySelector('[data-action="toggle-nav"]')?.addEventListener('click',()=>{sidebar?.classList.toggle('open');document.querySelector('.sidebar-backdrop')?.classList.toggle('open');});
  document.querySelector('[data-action="close-nav"]')?.addEventListener('click',()=>{sidebar?.classList.remove('open');document.querySelector('.sidebar-backdrop')?.classList.remove('open');});
  document.querySelector('[data-action="account-menu"]')?.addEventListener('click',(event)=>{const menu=event.currentTarget.parentElement.querySelector('.account-menu');menu.classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(menu.classList.contains('open')));});
  document.querySelector('[data-action="logout"]')?.addEventListener('click',onLogout);
}
