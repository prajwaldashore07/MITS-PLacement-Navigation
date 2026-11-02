let csrfToken='';
export function setCsrfToken(value){csrfToken=value||'';}
export async function api(path,options={}){
  const method=(options.method||'GET').toUpperCase();
  const headers=new Headers(options.headers||{});
  let body=options.body;
  if(body&&!(body instanceof FormData)&&typeof body!=='string'){
    headers.set('Content-Type','application/json');
    body=JSON.stringify(body);
  }
  if(['POST','PUT','PATCH','DELETE'].includes(method)&&csrfToken)headers.set('X-CSRF-Token',csrfToken);
  const response=await fetch(path,{method,headers,body,credentials:'same-origin',cache:'no-store'});
  const contentType=response.headers.get('content-type')||'';
  const payload=contentType.includes('application/json')?await response.json():{ok:response.ok,message:await response.text()};
  if(!response.ok||payload.ok===false){
    const error=new Error(payload.error?.message||payload.message||`Request failed (${response.status}).`);
    error.status=response.status;error.code=payload.error?.code;error.details=payload.error?.details;throw error;
  }
  if(payload.csrfToken)setCsrfToken(payload.csrfToken);
  return payload;
}

export function uploadFile(path,file,onProgress=()=>{}){
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    request.open('POST',path);
    request.setRequestHeader('Accept','application/json');
    if(csrfToken)request.setRequestHeader('X-CSRF-Token',csrfToken);
    request.upload.addEventListener('progress',(event)=>{
      if(event.lengthComputable)onProgress(Math.min(100,Math.round(event.loaded/event.total*100)));
    });
    request.addEventListener('load',()=>{
      let payload={};
      try{payload=JSON.parse(request.responseText||'{}');}catch{}
      if(request.status<200||request.status>=300||payload.ok===false){
        const error=new Error(payload.error?.message||`Upload failed (${request.status}).`);
        error.status=request.status;error.code=payload.error?.code;reject(error);return;
      }
      if(payload.csrfToken)setCsrfToken(payload.csrfToken);
      onProgress(100);
      resolve(payload);
    });
    request.addEventListener('error',()=>reject(new Error('The upload could not reach the server. Check your connection and try again.')));
    request.addEventListener('timeout',()=>reject(new Error('The upload timed out. Try again with a smaller PDF.')));
    request.timeout=120000;
    const form=new FormData();form.append('resume',file);
    request.send(form);
  });
}
