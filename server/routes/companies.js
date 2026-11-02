import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncRoute, HttpError, validateId } from '../middleware/errors.js';
import { requireRole } from '../middleware/session.js';
import { attachEligibility, getOpportunityRecords, getOneForStudent } from '../services/opportunities.js';

const router = Router();
router.use(requireRole('student'));

router.get('/companies', asyncRoute(async (req,res) => {
  const search = String(req.query.search || '').trim().slice(0,100).toLowerCase();
  const domain = String(req.query.domain || '').trim().toLowerCase();
  const location = String(req.query.location || '').trim().toLowerCase();
  const status = String(req.query.eligibility || '').trim();
  const branch = String(req.query.branch || '').trim().toUpperCase();
  const minPackage = req.query.minPackage === undefined ? null : Number(req.query.minPackage);
  const maxPackage = req.query.maxPackage === undefined ? null : Number(req.query.maxPackage);
  const minCgpa = req.query.minCgpa === undefined ? null : Number(req.query.minCgpa);
  if ([minPackage,maxPackage,minCgpa].some((value)=>value !== null && (!Number.isFinite(value) || value < 0)) || minCgpa > 10 || minPackage > 999 || maxPackage > 999 || (minPackage !== null && maxPackage !== null && minPackage > maxPackage)) throw new HttpError(400,'VALIDATION_ERROR','Use a valid package range and a CGPA value from 0 to 10.');
  if (status && !['Eligible','Skills Gap','Not Eligible','Deadline Passed'].includes(status)) throw new HttpError(400,'VALIDATION_ERROR','Eligibility status filter is invalid.');
  const page = Math.max(1,Math.min(500,Number.parseInt(req.query.page || '1',10) || 1));
  const pageSize = Math.max(1,Math.min(40,Number.parseInt(req.query.pageSize || '24',10) || 24));
  let opportunities = await getOpportunityRecords();
  opportunities = await attachEligibility(opportunities,req.auth.student);
  opportunities = opportunities.filter((item) => {
    if (search && !`${item.company_name} ${item.title}`.toLowerCase().includes(search)) return false;
    if (domain && item.domain_code.toLowerCase() !== domain && item.domain_name.toLowerCase() !== domain) return false;
    if (location && !item.location.toLowerCase().includes(location)) return false;
    if (status && item.eligibility.status !== status) return false;
    if (branch && !item.branches.includes(branch)) return false;
    if (minPackage !== null && item.package_lpa < minPackage) return false;
    if (maxPackage !== null && item.package_lpa > maxPackage) return false;
    if (minCgpa !== null && item.min_cgpa < minCgpa) return false;
    if (req.query.deadlineWithin) {
      const days = Number(req.query.deadlineWithin);
      if (!Number.isInteger(days) || days < 0 || days > 365) return false;
      const remaining = Math.ceil((new Date(`${item.application_deadline}T23:59:59Z`) - new Date())/86400000);
      if (remaining < 0 || remaining > days) return false;
    }
    return true;
  });
  const sort = String(req.query.sort || 'deadline').toLowerCase();
  if (sort === 'package_desc') opportunities.sort((a,b)=>b.package_lpa-a.package_lpa);
  else if (sort === 'package_asc') opportunities.sort((a,b)=>a.package_lpa-b.package_lpa);
  else if (sort === 'company') opportunities.sort((a,b)=>a.company_name.localeCompare(b.company_name));
  else if (sort === 'cgpa_asc') opportunities.sort((a,b)=>a.min_cgpa-b.min_cgpa);
  else opportunities.sort((a,b)=>a.application_deadline.localeCompare(b.application_deadline));
  const total = opportunities.length;
  const start = (page-1)*pageSize;
  const data = opportunities.slice(start,start+pageSize);
  const domains = await query('SELECT code,name FROM domains ORDER BY name');
  res.json({ok:true,items:data,total,page,pageSize,pages:Math.ceil(total/pageSize),domains,branches:['CSE','ECE','EEE','ME','CE'],sortOptions:['deadline','package_desc','package_asc','company','cgpa_asc'],notice:'All listed opportunities are fictional demonstration records; hiring status has not been verified.'});
}));

router.get('/companies/:id', asyncRoute(async (req,res) => {
  const id = validateId(req.params.id,'Opportunity id');
  const opportunity = await getOneForStudent(id,req.auth.student);
  if (!opportunity) throw new HttpError(404,'OPPORTUNITY_NOT_FOUND','That opportunity was not found.');
  res.json({ok:true,item:opportunity,notice:'Fictional demonstration opportunity; no employer has verified this listing.'});
}));

export default router;
