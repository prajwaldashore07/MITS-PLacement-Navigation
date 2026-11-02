import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSession } from './middleware/session.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import companyRoutes from './routes/companies.js';
import applicationRoutes from './routes/applications.js';
import preparationRoutes from './routes/preparation.js';
import learningRoutes from './routes/learning.js';
import adminRoutes from './routes/admin.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir=path.join(root,'public');
const clientDir=path.join(root,'client');
export const readiness={ready:false,error:null};
export const app=express();

app.disable('x-powered-by');
app.set('trust proxy',1);
// Keep the Preview iframe embeddable: no X-Frame-Options or frame-ancestors restriction is set.
app.use(helmet({frameguard:false,crossOriginEmbedderPolicy:false,contentSecurityPolicy:{useDefaults:false,directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],fontSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"]}}}));
app.use((req,res,next)=>{res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Content-Type-Options','nosniff');next();});
app.use(express.json({limit:'256kb'}));
app.use(express.urlencoded({extended:false,limit:'16kb'}));
app.use('/client',express.static(clientDir,{etag:true,maxAge:'5m'}));
app.use(express.static(publicDir,{index:false,etag:true,maxAge:'5m'}));

app.get('/health',(req,res)=>{
  if(!readiness.ready)return res.status(503).json({ok:false,status:'starting',message:readiness.error?'Database initialization failed.':'Database initialization is in progress.'});
  res.status(200).json({ok:true,status:'ready'});
});

const apiLimiter=rateLimit({windowMs:60*1000,limit:240,standardHeaders:true,legacyHeaders:false,message:{ok:false,error:{code:'RATE_LIMITED',message:'Too many requests. Please slow down.'}}});
app.use('/api',(req,res,next)=>{
  if(!readiness.ready)return res.status(503).json({ok:false,error:{code:'APP_NOT_READY',message:'The service is starting. Try again shortly.'}});
  next();
});
app.use('/api',loadSession,apiLimiter);
app.use('/api',authRoutes);
app.use('/api/student',studentRoutes);
app.use('/api',(req,res,next)=>req.path.startsWith('/companies')?companyRoutes(req,res,next):next());
app.use('/api',(req,res,next)=>/^\/applications(?:\/|$)/.test(req.path)||/^\/companies\/[^/]+\/apply$/.test(req.path)?applicationRoutes(req,res,next):next());
app.use('/api',(req,res,next)=>/^\/(?:preparation|tests|attempts)(?:\/|$)/.test(req.path)?preparationRoutes(req,res,next):next());
app.use('/api',(req,res,next)=>req.path.startsWith('/learning')?learningRoutes(req,res,next):next());
app.use('/api/admin',adminRoutes);
app.use('/api',(req,res)=>res.status(404).json({ok:false,error:{code:'API_NOT_FOUND',message:'API endpoint not found.'}}));

app.get(/.*/, (req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.use(errorHandler);
