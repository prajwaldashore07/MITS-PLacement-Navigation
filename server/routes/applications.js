import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncRoute, HttpError, validateId } from '../middleware/errors.js';
import { csrfGuard, requireRole } from '../middleware/session.js';
import { getOneForStudent } from '../services/opportunities.js';

const router = Router();
router.use(requireRole('student'));

router.get('/applications', asyncRoute(async (req,res) => {
  const search = String(req.query.search || '').trim().slice(0,100);
  const status = String(req.query.status || '').trim();
  const where = ['a.student_id=?'];
  const args = [req.auth.studentId];
  if (status) { where.push('a.status=?'); args.push(status); }
  if (search) { where.push('(c.name LIKE ? OR o.title LIKE ?)'); args.push(`%${search}%`,`%${search}%`); }
  const rows = await query(`SELECT a.id,a.status,a.applied_at,a.updated_at,o.id AS opportunity_id,o.title,o.package_lpa,o.location,c.name AS company_name,c.brand_mark,r.original_name AS resume_name FROM applications a JOIN opportunities o ON o.id=a.opportunity_id JOIN companies c ON c.id=o.company_id JOIN resumes r ON r.id=a.resume_id WHERE ${where.join(' AND ')} ORDER BY a.applied_at DESC`,args);
  const history = await Promise.all(rows.map((row)=>query('SELECT previous_status,new_status,changed_by_role,note,created_at FROM application_status_history WHERE application_id=? ORDER BY created_at ASC',[row.id])));
  res.json({ok:true,items:rows.map((row,index)=>({...row,history:history[index]})),statuses:['Applied','Assessment','Interview','Selected','Rejected','Withdrawn']});
}));

router.post('/companies/:id/apply', csrfGuard, asyncRoute(async (req,res) => {
  const opportunityId = validateId(req.params.id,'Opportunity id');
  const item = await getOneForStudent(opportunityId,req.auth.student);
  if (!item) throw new HttpError(404,'OPPORTUNITY_NOT_FOUND','That opportunity was not found.');
  if (item.eligibility.status !== 'Eligible') throw new HttpError(409,'NOT_ELIGIBLE',`Application cannot be recorded: ${item.eligibility.status}. Review the eligibility reasons first.`,{eligibility:item.eligibility});
  const resumes = await query('SELECT id FROM resumes WHERE student_id=? AND is_active=TRUE ORDER BY uploaded_at DESC LIMIT 1',[req.auth.studentId]);
  if (!resumes[0]) throw new HttpError(409,'RESUME_REQUIRED','Upload an active resume before applying.');
  try {
    const application = await withTransaction(async (connection) => {
      const [result] = await connection.execute('INSERT INTO applications (student_id,opportunity_id,resume_id,status) VALUES (?,?,?,\'Applied\')',[req.auth.studentId,opportunityId,resumes[0].id]);
      await connection.execute("INSERT INTO application_status_history (application_id,previous_status,new_status,changed_by_role,changed_by_student_id,note) VALUES (?,NULL,'Applied','student',?,'Recorded in the platform demonstration tracker; not sent to an employer.')",[result.insertId,req.auth.studentId]);
      return result.insertId;
    });
    res.status(201).json({ok:true,applicationId:application,confirmation:'Your interest is recorded in this platform’s demonstration tracker. It has not been sent to the employer.'});
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409,'DUPLICATE_APPLICATION','You have already recorded an application for this opportunity.');
    throw error;
  }
}));

router.patch('/applications/:id/withdraw', csrfGuard, asyncRoute(async (req,res) => {
  const id = validateId(req.params.id,'Application id');
  const result = await withTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id,status FROM applications WHERE id=? AND student_id=? FOR UPDATE',[id,req.auth.studentId]);
    const application = rows[0];
    if (!application) throw new HttpError(404,'APPLICATION_NOT_FOUND','Application record not found.');
    if (!['Applied','Assessment'].includes(application.status)) throw new HttpError(409,'WITHDRAWAL_UNAVAILABLE','This application can no longer be withdrawn from the student account.');
    await connection.execute("UPDATE applications SET status='Withdrawn' WHERE id=?",[id]);
    await connection.execute("INSERT INTO application_status_history (application_id,previous_status,new_status,changed_by_role,changed_by_student_id,note) VALUES (?,?,'Withdrawn','student',?,'Withdrawn by the student in the platform tracker.')",[id,application.status,req.auth.studentId]);
    return true;
  });
  res.json({ok:true,withdrawn:result});
}));

export default router;
