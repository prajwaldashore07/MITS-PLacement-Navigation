import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, readiness } from './app.js';
import { pool } from './db/pool.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port=Number(process.env.PORT)||3000;
const server=app.listen(port,'0.0.0.0',()=>console.log(`MITS Placement Navigation listening on 0.0.0.0:${port}`));

function runScript(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(root,script)],{cwd:root,env:process.env,stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`${script} exited with ${signal||code}`)));
  });
}

try{
  await runScript('database/migrate.js');
  await runScript('database/seed.js');
  readiness.ready=true;
  console.log('Database is ready; fictional demonstration data is available.');
}catch(error){
  readiness.error=error.code||error.name||'INITIALIZATION_FAILED';
  console.error(JSON.stringify({event:'startup_initialization_failed',errorCode:error.code||undefined,errorName:error.name||'Error'}));
}

async function shutdown(signal){
  console.log(`Received ${signal}; closing application.`);
  server.close(async()=>{await pool.end();process.exit(0);});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
