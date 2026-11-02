import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { Readable } from 'node:stream';
import { pool, query, withTransaction } from '../db/pool.js';
import { asyncRoute, HttpError, validateId, validateRating, validateString } from '../middleware/errors.js';
import { csrfGuard, requireRole } from '../middleware/session.js';
import { getOpportunityRecords, attachEligibility } from '../services/opportunities.js';

const router = Router();
const studentOnly = [requireRole('student')];
const writeStudent = [requireRole('student'), csrfGuard];
const MAX_RESUME_BYTES = Math.min(10 * 1024 * 1024, Math.max(100 * 1024, Number(process.env.MAX_RESUME_BYTES) || 5 * 1024 * 1024));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RESUME_BYTES, files: 1 } });

async function onboardingData(studentId) {
  const [domains, interests, skills, customSkills, resume] = await Promise.all([
    query('SELECT id,code,name,description,icon FROM domains ORDER BY id'),
    query('SELECT d.id,d.code,d.name FROM student_interests i JOIN domains d ON d.id=i.domain_id WHERE i.student_id=? ORDER BY d.name', [studentId]),
    query('SELECT s.id,s.name,s.category,s.description,COALESCE(ss.rating,0) AS rating,(ss.skill_id IS NOT NULL) AS selected,sd.domain_id FROM skills s LEFT JOIN student_skills ss ON ss.skill_id=s.id AND ss.student_id=? LEFT JOIN skill_domains sd ON sd.skill_id=s.id ORDER BY s.category,s.name', [studentId]),
    query('SELECT id,name,category,rating FROM student_custom_skills WHERE student_id=? ORDER BY name', [studentId]),
    query('SELECT id,original_name,size_bytes,mime_type,uploaded_at FROM resumes WHERE student_id=? AND is_active=TRUE ORDER BY uploaded_at DESC LIMIT 1', [studentId]),
  ]);
  const map = new Map();
  for (const skill of skills) {
    const key = Number(skill.id);
    if (!map.has(key)) map.set(key, { id: key, name: skill.name, category: skill.category, description: skill.description, rating: Number(skill.rating), selected: Boolean(skill.selected), domainIds: [] });
    if (skill.domain_id && !map.get(key).domainIds.includes(Number(skill.domain_id))) map.get(key).domainIds.push(Number(skill.domain_id));
  }
  return { domains, interests, skills: [...map.values()], customSkills: customSkills.map((item) => ({ ...item, id: Number(item.id), rating: Number(item.rating) })), resume: resume[0] || null };
}

async function profileCompletion(studentId) {
  const [interest, skill, resume, projects, achievements, goals] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM student_interests WHERE student_id=?', [studentId]),
    query('SELECT (SELECT COUNT(*) FROM student_skills WHERE student_id=?) + (SELECT COUNT(*) FROM student_custom_skills WHERE student_id=?) AS count', [studentId,studentId]),
    query('SELECT COUNT(*) AS count FROM resumes WHERE student_id=? AND is_active=TRUE', [studentId]),
    query('SELECT COUNT(*) AS count FROM student_projects WHERE student_id=?', [studentId]),
    query('SELECT COUNT(*) AS count FROM student_achievements WHERE student_id=?', [studentId]),
    query('SELECT COUNT(*) AS count FROM learning_goals WHERE student_id=?', [studentId]),
  ]);
  const steps = [25, Number(interest[0].count) ? 15 : 0, Number(skill[0].count) ? 25 : 0, Number(resume[0].count) ? 20 : 0, Number(projects[0].count) || Number(achievements[0].count) || Number(goals[0].count) ? 15 : 0];
  return Math.min(100, steps.reduce((a,b) => a + b, 0));
}

router.get('/onboarding', ...studentOnly, asyncRoute(async (req, res) => {
  const data = await onboardingData(req.auth.studentId);
  res.json({ ok: true, student: req.auth.student, onboardingStep: req.auth.student.onboarding_step, ...data });
}));

router.put('/interests', ...writeStudent, asyncRoute(async (req, res) => {
  const ids = req.body?.domainIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 8) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose at least one career interest.');
  const normalized = [...new Set(ids.map((id) => validateId(id, 'Domain id')))];
  const existing = await query(`SELECT id FROM domains WHERE id IN (${normalized.map(() => '?').join(',')})`, normalized);
  if (existing.length !== normalized.length) throw new HttpError(400, 'VALIDATION_ERROR', 'One or more career interests are not available.');
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM student_interests WHERE student_id=?', [req.auth.studentId]);
    for (const domainId of normalized) await connection.execute('INSERT INTO student_interests (student_id,domain_id) VALUES (?,?)', [req.auth.studentId,domainId]);
    await connection.execute("UPDATE students SET onboarding_step='skills' WHERE id=? AND onboarding_step <> 'complete'", [req.auth.studentId]);
  });
  res.json({ ok: true, saved: normalized.length, nextStep: 'skills' });
}));

router.put('/skills', ...writeStudent, asyncRoute(async (req, res) => {
  const skills = req.body?.skills;
  const customSkills = req.body?.customSkills || [];
  if (!Array.isArray(skills) || skills.length > 100 || !Array.isArray(customSkills) || customSkills.length > 30) throw new HttpError(400, 'VALIDATION_ERROR', 'Skills must be submitted as a reasonable list.');
  const cleanSkills = skills.map((item) => ({ id: validateId(item?.id, 'Skill id'), rating: validateRating(item?.rating) }));
  if (new Set(cleanSkills.map((item) => item.id)).size !== cleanSkills.length) throw new HttpError(400, 'VALIDATION_ERROR', 'A skill can appear only once.');
  const skillIds = cleanSkills.map((item) => item.id);
  if (skillIds.length) {
    const known = await query(`SELECT id FROM skills WHERE id IN (${skillIds.map(() => '?').join(',')})`, skillIds);
    if (known.length !== skillIds.length) throw new HttpError(400, 'VALIDATION_ERROR', 'One or more skills are not available.');
  }
  const custom = customSkills.map((item) => ({ name: validateString(item?.name,'Custom skill',{min:2,max:80}), category: validateString(item?.category || 'Other','Skill category',{min:2,max:60}), rating: validateRating(item?.rating) }));
  if (new Set(custom.map((item) => item.name.toLowerCase())).size !== custom.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Custom skills must have unique names.');
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM student_skills WHERE student_id=?', [req.auth.studentId]);
    for (const item of cleanSkills) await connection.execute('INSERT INTO student_skills (student_id,skill_id,rating) VALUES (?,?,?)', [req.auth.studentId,item.id,item.rating]);
    const existingCustom = await connection.execute('SELECT id,name FROM student_custom_skills WHERE student_id=?', [req.auth.studentId]);
    const keep = new Set(custom.map((item) => item.name.toLowerCase()));
    for (const row of existingCustom[0]) if (!keep.has(row.name.toLowerCase())) await connection.execute('DELETE FROM student_custom_skills WHERE id=? AND student_id=?', [row.id,req.auth.studentId]);
    for (const item of custom) await connection.execute('INSERT INTO student_custom_skills (student_id,name,category,rating) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE category=VALUES(category),rating=VALUES(rating)', [req.auth.studentId,item.name,item.category,item.rating]);
    await connection.execute("UPDATE students SET onboarding_step='resume' WHERE id=? AND onboarding_step <> 'complete'", [req.auth.studentId]);
  });
  res.json({ ok: true, saved: cleanSkills.length + custom.length, nextStep: 'resume' });
}));

router.get('/dashboard', ...studentOnly, asyncRoute(async (req, res) => {
  const student = req.auth.student;
  const [opportunities, applicationRows, statusRows, testRows, learningRows, completedRows, activeResume, projectRows, goalRows, skillRows, skillCategoryRows, roadmapProgressRows] = await Promise.all([
    getOpportunityRecords(),
    query("SELECT COUNT(*) AS count FROM applications WHERE student_id=? AND status <> 'Withdrawn'", [student.id]),
    query('SELECT status,COUNT(*) AS count FROM applications WHERE student_id=? GROUP BY status', [student.id]),
    query('SELECT id,test_id,score,total_questions,started_at,submitted_at FROM test_attempts WHERE student_id=? AND status <> \'in_progress\' ORDER BY started_at DESC LIMIT 8', [student.id]),
    query('SELECT COUNT(*) AS total FROM roadmap_topics t JOIN roadmaps r ON r.id=t.roadmap_id WHERE r.is_active=TRUE'),
    query('SELECT COUNT(*) AS completed FROM student_topic_progress WHERE student_id=? AND completed=TRUE', [student.id]),
    query('SELECT id FROM resumes WHERE student_id=? AND is_active=TRUE LIMIT 1', [student.id]),
    query('SELECT COUNT(*) AS count FROM student_projects WHERE student_id=?', [student.id]),
    query('SELECT COUNT(*) AS count FROM learning_goals WHERE student_id=?', [student.id]),
    query('SELECT ss.skill_id,ss.rating,s.name FROM student_skills ss JOIN skills s ON s.id=ss.skill_id WHERE ss.student_id=? ORDER BY ss.rating ASC LIMIT 20', [student.id]),
    query('SELECT category,AVG(rating) AS average,COUNT(*) AS skill_count FROM (SELECT s.category,ss.rating FROM student_skills ss JOIN skills s ON s.id=ss.skill_id WHERE ss.student_id=? UNION ALL SELECT category,rating FROM student_custom_skills WHERE student_id=?) ratings GROUP BY category ORDER BY average ASC,category', [student.id,student.id]),
    query('SELECT r.id,r.title,COUNT(t.id) AS total,COALESCE(SUM(CASE WHEN p.completed=TRUE THEN 1 ELSE 0 END),0) AS completed FROM roadmaps r LEFT JOIN roadmap_topics t ON t.roadmap_id=r.id LEFT JOIN student_topic_progress p ON p.topic_id=t.id AND p.student_id=? WHERE r.is_active=TRUE GROUP BY r.id,r.title ORDER BY r.title', [student.id]),
  ]);
  const matched = await attachEligibility(opportunities, student);
  const statusCount = { 'Eligible':0, 'Skills Gap':0, 'Not Eligible':0, 'Deadline Passed':0 };
  for (const item of matched) statusCount[item.eligibility.status] += 1;
  const statuses = Object.fromEntries(statusRows.map((row) => [row.status,Number(row.count)]));
  const profileCompletionPercent = await profileCompletion(student.id);
  const testHistory = await Promise.all(testRows.map(async (attempt) => {
    const rows = await query('SELECT title,category FROM mock_tests WHERE id=?', [attempt.test_id]);
    return { ...attempt, score: Number(attempt.score || 0), total_questions: Number(attempt.total_questions), test_title: rows[0]?.title || 'Mock test', category: rows[0]?.category || 'Assessment' };
  }));
  const eligibleByDomain = matched.reduce((map,item) => { if (item.eligibility.status === 'Eligible') map[item.domain_name] = (map[item.domain_name] || 0) + 1; return map; }, {});
  const skillsByCategory=skillCategoryRows.map((item)=>({category:item.category,average:Math.round(Number(item.average)*10)/10,count:Number(item.skill_count)}));
  const roadmapProgress=roadmapProgressRows.map((item)=>({title:item.title,completed:Number(item.completed),total:Number(item.total),percent:Number(item.total)?Math.round(Number(item.completed)/Number(item.total)*100):0}));
  const applicationStatusDistribution = Object.entries(statuses).map(([status,count]) => ({ status,count }));
  const roadmapTotal = Number(learningRows[0].total);
  const roadmapComplete = Math.min(roadmapTotal,Number(completedRows[0].completed));
  let recommendation;
  const weakest = skillRows[0];
  if (student.onboarding_step !== 'complete') recommendation = { title: 'Finish your setup', description: 'Complete the remaining onboarding step to unlock your placement workspace.', href: `/onboarding/${student.onboarding_step}` };
  else if (statusCount['Skills Gap'] > 0 && weakest) recommendation = { title: `Build confidence in ${weakest.name}`, description: `${statusCount['Skills Gap']} opportunities have a skill gap. Your ${weakest.name} self-assessment is ${weakest.rating}/10; review a related roadmap topic.`, href: '/learning' };
  else if (roadmapTotal && roadmapComplete < roadmapTotal) recommendation = { title: 'Continue a learning roadmap', description: `${roadmapComplete} of ${roadmapTotal} listed topics are marked complete.`, href: '/learning' };
  else recommendation = { title: 'Explore matching roles', description: 'Review eligibility details and build a preparation plan for the roles that fit your profile.', href: '/companies?eligibility=Eligible' };
  const upcomingDeadlines = matched.filter((item) => item.eligibility.status === 'Eligible' || item.eligibility.status === 'Skills Gap').slice(0,4).map((item) => ({ id:item.id,company_name:item.company_name,title:item.title,deadline:item.application_deadline }));
  res.json({ ok:true, student, profileCompletion:profileCompletionPercent, opportunityCounts:{ total:matched.length, eligible:statusCount['Eligible'], skillsGap:statusCount['Skills Gap'], matching:statusCount['Eligible'] + statusCount['Skills Gap'] }, applications:{ count:Number(applicationRows[0].count), byStatus:applicationStatusDistribution }, upcomingDeadlines, mockTests:{ attempts:testHistory, averageScore:testHistory.length ? Math.round(testHistory.reduce((sum,item) => sum + item.score,0)/testHistory.length) : null, scoreTrend:testHistory.slice().reverse().map((item)=>({label:new Date(item.submitted_at||item.started_at).toLocaleDateString('en',{month:'short',day:'numeric'}),score:Math.round(item.score)})) }, learning:{ completed:roadmapComplete,total:roadmapTotal,percent:roadmapTotal ? Math.round(roadmapComplete/roadmapTotal*100) : 0,roadmaps:roadmapProgress }, skillSummary:skillRows.map((item)=>({name:item.name,rating:Number(item.rating)})), skillsByCategory, eligibleByDomain:Object.entries(eligibleByDomain).map(([domain,count])=>({domain,count})), recommendation, resumePresent:Boolean(activeResume.length), projectCount:Number(projectRows[0].count), goalCount:Number(goalRows[0].count), demoNotice:'Student and opportunity records are fictional demonstration data. Applications are tracked here and are not sent to employers.' });
}));

router.get('/profile', ...studentOnly, asyncRoute(async (req, res) => {
  const data = await onboardingData(req.auth.studentId);
  const [projects, achievements, goals, percent] = await Promise.all([
    query('SELECT id,title,description,url,sort_order FROM student_projects WHERE student_id=? ORDER BY sort_order,id', [req.auth.studentId]),
    query("SELECT id,title,description,DATE_FORMAT(achieved_on,'%Y-%m-%d') AS achieved_on,url FROM student_achievements WHERE student_id=? ORDER BY achieved_on DESC,id DESC", [req.auth.studentId]),
    query('SELECT id,goal,target_date FROM learning_goals WHERE student_id=? ORDER BY target_date,id', [req.auth.studentId]),
    profileCompletion(req.auth.studentId),
  ]);
  res.json({ ok:true, student:req.auth.student, profileCompletion:percent, ...data, projects, achievements, learningGoals:goals });
}));

router.put('/profile', ...writeStudent, asyncRoute(async (req, res) => {
  for (const field of ['enrollment_no','enrollmentNumber','branch','batch','cgpa','academic_year','academicYear','active_backlogs']) if (Object.hasOwn(req.body || {}, field)) throw new HttpError(403, 'OFFICIAL_RECORD_READ_ONLY', 'Official academic records can only be changed by an authorized administrator.');
  const projects = req.body?.projects || [];
  const achievements = req.body?.achievements || [];
  const goals = req.body?.learningGoals || [];
  if (!Array.isArray(projects) || projects.length > 12 || !Array.isArray(achievements) || achievements.length > 12 || !Array.isArray(goals) || goals.length > 12) throw new HttpError(400, 'VALIDATION_ERROR', 'Add up to 12 projects, 12 achievements and 12 learning goals.');
  const cleanProjects = projects.map((item) => ({ title:validateString(item?.title,'Project title',{max:160}), description:validateString(item?.description || 'Project summary', 'Project description',{max:4000}), url:item?.url ? validateString(item.url,'Project URL',{max:500}) : null }));
  for (const item of cleanProjects) if (item.url && !/^https?:\/\//i.test(item.url)) throw new HttpError(400,'VALIDATION_ERROR','Project links must start with https:// or http://.');
  const cleanAchievements = achievements.map((item) => ({ title:validateString(item?.title,'Achievement title',{max:160}), description:item?.description ? validateString(item.description,'Achievement description',{max:4000}) : '', achievedOn:item?.achievedOn ? String(item.achievedOn) : null, url:item?.url ? validateString(item.url,'Achievement URL',{max:500}) : null }));
  for (const item of cleanAchievements) {
    const parsedDate = item.achievedOn ? new Date(`${item.achievedOn}T00:00:00Z`) : null;
    if (item.achievedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(item.achievedOn) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== item.achievedOn)) throw new HttpError(400,'VALIDATION_ERROR','Achievement dates must use a valid YYYY-MM-DD date.');
    if (item.url && !/^https?:\/\//i.test(item.url)) throw new HttpError(400,'VALIDATION_ERROR','Achievement links must start with https:// or http://.');
  }
  const cleanGoals = goals.map((item) => ({ goal:validateString(typeof item === 'string' ? item : item?.goal,'Learning goal',{max:255}), targetDate:typeof item === 'string' || !item?.targetDate ? null : String(item.targetDate) }));
  for (const item of cleanGoals) {
    const parsedDate = item.targetDate ? new Date(`${item.targetDate}T00:00:00Z`) : null;
    if (item.targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(item.targetDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== item.targetDate)) throw new HttpError(400,'VALIDATION_ERROR','Use a valid YYYY-MM-DD target date.');
  }
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM student_projects WHERE student_id=?', [req.auth.studentId]);
    await connection.execute('DELETE FROM student_achievements WHERE student_id=?', [req.auth.studentId]);
    await connection.execute('DELETE FROM learning_goals WHERE student_id=?', [req.auth.studentId]);
    for (const [index,item] of cleanProjects.entries()) await connection.execute('INSERT INTO student_projects (student_id,title,description,url,sort_order) VALUES (?,?,?,?,?)', [req.auth.studentId,item.title,item.description,item.url,index]);
    for (const item of cleanAchievements) await connection.execute('INSERT INTO student_achievements (student_id,title,description,achieved_on,url) VALUES (?,?,?,?,?)', [req.auth.studentId,item.title,item.description,item.achievedOn,item.url]);
    for (const item of cleanGoals) await connection.execute('INSERT INTO learning_goals (student_id,goal,target_date) VALUES (?,?,?)', [req.auth.studentId,item.goal,item.targetDate]);
  });
  res.json({ ok:true, message:'Profile details saved.' });
}));

router.post('/resume', ...writeStudent, (req,res,next) => upload.single('resume')(req,res,(error)=> {
  if (error) return next(error);
  next();
}), asyncRoute(async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400,'RESUME_REQUIRED','Choose a PDF resume to upload.');
  if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname) || file.buffer.subarray(0,5).toString('ascii') !== '%PDF-') throw new HttpError(400,'INVALID_RESUME','Upload a valid PDF file.');
  if (!process.env.MANUS_API_URL || !process.env.MANUS_API_KEY) throw new HttpError(503,'STORAGE_UNAVAILABLE','Private resume storage is not configured for this environment.');
  const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g,'_').slice(-120) || 'resume.pdf';
  const objectKey = `student-resumes/${req.auth.studentId}/${crypto.randomBytes(16).toString('hex')}-${safeName}`;
  const presignUrl = new URL('/v1/storage/presign/put', process.env.MANUS_API_URL);
  presignUrl.searchParams.set('path', objectKey);
  const presign = await fetch(presignUrl, { headers:{ Authorization:`Bearer ${process.env.MANUS_API_KEY}` } });
  const presignData = await presign.json().catch(() => ({}));
  if (!presign.ok || !presignData.url) throw new HttpError(502,'STORAGE_UPLOAD_FAILED','Could not prepare private resume storage. Try again later.');
  const uploaded = await fetch(presignData.url,{ method:'PUT',headers:{'Content-Type':'application/pdf'},body:file.buffer });
  if (!uploaded.ok) throw new HttpError(502,'STORAGE_UPLOAD_FAILED','The PDF could not be stored. Try again later.');
  const resume = await withTransaction(async (connection) => {
    await connection.execute('UPDATE resumes SET is_active=FALSE,removed_at=NOW() WHERE student_id=? AND is_active=TRUE', [req.auth.studentId]);
    const [result] = await connection.execute('INSERT INTO resumes (student_id,object_key,original_name,mime_type,size_bytes,is_active) VALUES (?,?,?,?,?,TRUE)', [req.auth.studentId,objectKey,file.originalname,'application/pdf',file.size]);
    await connection.execute("UPDATE students SET onboarding_step='complete' WHERE id=?", [req.auth.studentId]);
    return { id:result.insertId, original_name:file.originalname, size_bytes:file.size, uploaded_at:new Date() };
  });
  res.status(201).json({ ok:true, resume, message:'Resume uploaded to private storage.' });
}));

router.delete('/resume/:id', ...writeStudent, asyncRoute(async (req,res) => {
  const id = validateId(req.params.id,'Resume id');
  const result = await query('UPDATE resumes SET is_active=FALSE,removed_at=NOW() WHERE id=? AND student_id=? AND is_active=TRUE', [id,req.auth.studentId]);
  if (!result.affectedRows) throw new HttpError(404,'RESUME_NOT_FOUND','That active resume could not be found.');
  res.json({ ok:true, message:'Resume removed from your active profile. Physical object erasure is handled through authorized storage operations.' });
}));

router.get('/resume/:id/download', ...studentOnly, asyncRoute(async (req,res) => {
  const id = validateId(req.params.id,'Resume id');
  const rows = await query('SELECT object_key,original_name,mime_type FROM resumes WHERE id=? AND student_id=? AND is_active=TRUE LIMIT 1', [id,req.auth.studentId]);
  if (!rows[0]) throw new HttpError(404,'RESUME_NOT_FOUND','That active resume could not be found.');
  if (!process.env.MANUS_API_URL || !process.env.MANUS_API_KEY) throw new HttpError(503,'STORAGE_UNAVAILABLE','Private resume storage is not configured for this environment.');
  const url = new URL('/v1/storage/presign/get', process.env.MANUS_API_URL);
  url.searchParams.set('path',rows[0].object_key);
  const presigned = await fetch(url,{headers:{Authorization:`Bearer ${process.env.MANUS_API_KEY}`}});
  const payload = await presigned.json().catch(()=>({}));
  if (!presigned.ok || !payload.url) throw new HttpError(502,'STORAGE_DOWNLOAD_FAILED','Could not retrieve the private resume.');
  const fileResponse = await fetch(payload.url);
  if (!fileResponse.ok || !fileResponse.body) throw new HttpError(502,'STORAGE_DOWNLOAD_FAILED','The private resume is temporarily unavailable.');
  const originalName=String(rows[0].original_name||'resume.pdf');
  const asciiName=originalName.normalize('NFKD').replace(/[^\x20-\x7E]/g,'_').replace(/["\\;\r\n]/g,'_').slice(0,120)||'resume.pdf';
  const encodedName=encodeURIComponent(originalName).replace(/[!'()*]/g,(character)=>`%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  res.setHeader('Cache-Control','private, no-store');
  Readable.fromWeb(fileResponse.body).pipe(res);
}));

export default router;
