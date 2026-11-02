import { Router } from 'express';
import { pool, query, withTransaction } from '../db/pool.js';
import { asyncRoute, HttpError, validateEmail, validateId, validateString } from '../middleware/errors.js';
import { csrfGuard, requireRole } from '../middleware/session.js';
import { getOpportunityRecords } from '../services/opportunities.js';

const router=Router();
router.use(requireRole('admin'));
const writeAdmin=[csrfGuard];
const appStatuses=['Applied','Assessment','Interview','Selected','Rejected','Withdrawn'];
const opportunityStatuses=['active','paused','closed'];
const branchCodes=['CSE','ECE','EEE','ME','CE'];
const academicYearOptions=['1st year','2nd year','3rd year','4th year'];

async function audit(connection,adminId,action,entityType,entityId,summary){
  await connection.execute('INSERT INTO audit_logs (admin_id,action,entity_type,entity_id,summary) VALUES (?,?,?,?,?)',[adminId,action,entityType,entityId,summary.slice(0,500)]);
}

function numeric(value,label,{min=0,max=100000}={}){
  const number=Number(value);
  if(!Number.isFinite(number)||number<min||number>max)throw new HttpError(400,'VALIDATION_ERROR',`${label} must be between ${min} and ${max}.`);
  return number;
}
function httpsResourceUrl(value){const raw=validateString(value,'Resource URL',{max:600});let parsed;try{parsed=new URL(raw);}catch{throw new HttpError(400,'VALIDATION_ERROR','Enter a valid HTTPS resource URL.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new HttpError(400,'VALIDATION_ERROR','Resource URLs must use HTTPS and cannot contain embedded credentials.');return parsed.toString();}
function cleanDeadline(value){const date=validateString(value,'Application deadline',{min:10,max:10});if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))throw new HttpError(400,'VALIDATION_ERROR','Use a valid YYYY-MM-DD deadline.');return date;}

router.get('/dashboard',asyncRoute(async(req,res)=>{
  const [students,active,applications,opportunityStatuses,applicationStatuses,latestAudit]=await Promise.all([
    query('SELECT COUNT(*) AS count FROM students'),
    query("SELECT COUNT(*) AS count FROM opportunities WHERE status='active' AND application_deadline>=CURDATE()"),
    query('SELECT COUNT(*) AS count FROM applications'),
    query('SELECT status,COUNT(*) AS count FROM opportunities GROUP BY status'),
    query('SELECT status,COUNT(*) AS count FROM applications GROUP BY status'),
    query('SELECT a.id,a.action,a.entity_type,a.entity_id,a.summary,a.created_at,ad.full_name AS admin_name FROM audit_logs a LEFT JOIN admins ad ON ad.id=a.admin_id ORDER BY a.created_at DESC LIMIT 8'),
  ]);
  res.json({ok:true,stats:{students:Number(students[0].count),activeOpportunities:Number(active[0].count),applications:Number(applications[0].count)},opportunityStatuses:opportunityStatuses.map((row)=>({status:row.status,count:Number(row.count)})),applicationStatuses:applicationStatuses.map((row)=>({status:row.status,count:Number(row.count)})),recentAudit:latestAudit});
}));

router.get('/students',asyncRoute(async(req,res)=>{
  const search=String(req.query.search||'').trim().slice(0,100);
  const branch=String(req.query.branch||'').trim().toUpperCase();
  const where=[];const values=[];
  if(search){where.push('(s.enrollment_no LIKE ? OR s.full_name LIKE ?)');values.push(`%${search}%`,`%${search}%`);}
  if(branch){where.push('s.branch=?');values.push(branch);}
  const rows=await query(`SELECT s.id,s.enrollment_no,s.full_name,s.branch,s.academic_year,s.batch,s.cgpa,s.onboarding_step,f.active_backlogs,(SELECT COUNT(*) FROM applications a WHERE a.student_id=s.id) AS applications_count FROM students s LEFT JOIN student_academic_facts f ON f.student_id=s.id ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY s.batch,s.branch,s.enrollment_no LIMIT 250`,values);
  res.json({ok:true,items:rows.map((item)=>({...item,id:Number(item.id),batch:Number(item.batch),cgpa:Number(item.cgpa),active_backlogs:item.active_backlogs===null?null:Number(item.active_backlogs),applications_count:Number(item.applications_count)})),branches:branchCodes});
}));

router.patch('/students/:id',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Student id');
  const body=req.body||{};
  const enrollment=validateString(body.enrollment_no,'Enrollment number',{min:8,max:32}).toUpperCase();
  const fullName=validateString(body.full_name,'Student name',{max:160});
  const branch=validateString(body.branch,'Branch',{min:2,max:16}).toUpperCase();
  if(!branchCodes.includes(branch))throw new HttpError(400,'VALIDATION_ERROR','Choose a supported branch.');
  const academicYear=validateString(body.academic_year,'Academic year',{max:20});
  const batch=Math.round(numeric(body.batch,'Graduation batch',{min:2000,max:2100}));
  const cgpa=numeric(body.cgpa,'CGPA',{min:0,max:10});
  const activeBacklogs=numeric(body.active_backlogs,'Active backlog count',{min:0,max:50});
  if(!Number.isInteger(activeBacklogs))throw new HttpError(400,'VALIDATION_ERROR','Active backlog count must be a whole number.');
  await withTransaction(async(connection)=>{
    const [rows]=await connection.execute('SELECT enrollment_no FROM students WHERE id=?',[id]);
    if(!rows[0])throw new HttpError(404,'STUDENT_NOT_FOUND','Student record not found.');
    await connection.execute('UPDATE students SET enrollment_no=?,full_name=?,branch=?,academic_year=?,batch=?,cgpa=? WHERE id=?',[enrollment,fullName,branch,academicYear,batch,cgpa,id]);
    await connection.execute('INSERT INTO student_academic_facts (student_id,active_backlogs) VALUES (?,?) ON DUPLICATE KEY UPDATE active_backlogs=VALUES(active_backlogs)',[id,activeBacklogs]);
    await audit(connection,req.auth.adminId,'update','student',id,`Updated official academic record for ${enrollment}, including ${activeBacklogs} active backlogs.`);
  });
  res.json({ok:true,message:'Official academic record updated.'});
}));

async function saveOpportunity(req,existingId=null){
  const body=req.body||{};
  const companyName=validateString(body.companyName,'Company name',{max:160});
  const title=validateString(body.title,'Role title',{max:180});
  const domainId=validateId(body.domainId,'Domain id');
  const packageLpa=numeric(body.packageLpa,'Package',{min:0,max:999.99});
  const location=validateString(body.location,'Location',{max:120});
  const workMode=validateString(body.workMode||'On-site','Work mode',{max:20});
  if(!['On-site','Hybrid','Remote'].includes(workMode))throw new HttpError(400,'VALIDATION_ERROR','Choose On-site, Hybrid or Remote.');
  const minCgpa=numeric(body.minCgpa,'Minimum CGPA',{min:0,max:10});
  const batchFrom=Math.round(numeric(body.batchFrom,'Batch from',{min:2000,max:2100}));
  const batchTo=Math.round(numeric(body.batchTo,'Batch to',{min:2000,max:2100}));
  if(batchFrom>batchTo)throw new HttpError(400,'VALIDATION_ERROR','Batch start must be no later than batch end.');
  const deadline=cleanDeadline(body.deadline);
  const status=body.status||'active';
  if(!opportunityStatuses.includes(status))throw new HttpError(400,'VALIDATION_ERROR','Opportunity status is invalid.');
  const description=validateString(body.description,'Role description',{max:10000});
  const extraRules=String(body.extraRules||'').trim().slice(0,500);
  const rawMaxBacklogs=body.maxActiveBacklogs;
  const maxActiveBacklogs=rawMaxBacklogs===null||rawMaxBacklogs===undefined||String(rawMaxBacklogs).trim()===''?null:numeric(rawMaxBacklogs,'Maximum active backlogs',{min:0,max:50});
  if(maxActiveBacklogs!==null&&!Number.isInteger(maxActiveBacklogs))throw new HttpError(400,'VALIDATION_ERROR','Maximum active backlogs must be a whole number.');
  const branches=Array.isArray(body.branches)?[...new Set(body.branches.map((item)=>String(item).toUpperCase()))]:[];
  if(!branches.length||branches.some((branch)=>!branchCodes.includes(branch)))throw new HttpError(400,'VALIDATION_ERROR','Select at least one supported eligible branch.');
  const academicYears=Array.isArray(body.academicYears)?[...new Set(body.academicYears.map((item)=>String(item)))]:[];
  if(academicYears.some((year)=>!academicYearOptions.includes(year)))throw new HttpError(400,'VALIDATION_ERROR','Choose supported academic years.');
  const skills=Array.isArray(body.skillRequirements)?body.skillRequirements:[];
  if(skills.length>30)throw new HttpError(400,'VALIDATION_ERROR','Add no more than 30 skill criteria.');
  const cleanSkills=skills.map((item)=>({id:validateId(item.skillId,'Skill id'),min:numeric(item.minRating,'Minimum skill rating',{min:0,max:10}),type:item.type==='preferred'?'preferred':'required'}));
  if(new Set(cleanSkills.map((item)=>item.id)).size!==cleanSkills.length)throw new HttpError(400,'VALIDATION_ERROR','Each skill criterion can appear only once.');
  const stages=Array.isArray(body.stages)?body.stages.map((item)=>validateString(item,'Recruitment stage',{max:100})):[];
  if(stages.length>12)throw new HttpError(400,'VALIDATION_ERROR','Add no more than 12 recruitment stages.');
  const domains=await query('SELECT id FROM domains WHERE id=?',[domainId]);
  if(!domains[0])throw new HttpError(400,'VALIDATION_ERROR','The selected domain does not exist.');
  if(cleanSkills.length){const known=await query(`SELECT id FROM skills WHERE id IN (${cleanSkills.map(()=>'?').join(',')})`,cleanSkills.map((item)=>item.id));if(known.length!==cleanSkills.length)throw new HttpError(400,'VALIDATION_ERROR','One or more skill criteria do not exist.');}
  const companyId=await withTransaction(async(connection)=>{
    await connection.execute('INSERT IGNORE INTO companies (name,brand_mark,description,is_demo) VALUES (?,?,?,TRUE)',[companyName,companyName.split(/\s+/).map((part)=>part[0]).join('').slice(0,3).toUpperCase(),`Fictional demonstration employer profile for ${companyName}.`]);
    const [companyRows]=await connection.execute('SELECT id FROM companies WHERE name=?',[companyName]);
    const cId=companyRows[0].id;
    let opportunityId=existingId;
    if(existingId){
      const [found]=await connection.execute('SELECT id,company_id FROM opportunities WHERE id=?',[existingId]);
      if(!found[0])throw new HttpError(404,'OPPORTUNITY_NOT_FOUND','Opportunity not found.');
      opportunityId=Number(found[0].id);
      await connection.execute('UPDATE opportunities SET company_id=?,title=?,domain_id=?,package_lpa=?,location=?,work_mode=?,min_cgpa=?,batch_from=?,batch_to=?,application_deadline=?,status=?,job_description=?,extra_rules=? WHERE id=?',[cId,title,domainId,packageLpa,location,workMode,minCgpa,batchFrom,batchTo,deadline,status,description,extraRules,opportunityId]);
      await connection.execute('DELETE FROM opportunity_branches WHERE opportunity_id=?',[opportunityId]);
      await connection.execute('DELETE FROM opportunity_academic_years WHERE opportunity_id=?',[opportunityId]);
      await connection.execute('DELETE FROM opportunity_eligibility_rules WHERE opportunity_id=?',[opportunityId]);
      await connection.execute('DELETE FROM opportunity_skill_requirements WHERE opportunity_id=?',[opportunityId]);
      await connection.execute('DELETE FROM opportunity_stages WHERE opportunity_id=?',[opportunityId]);
      await audit(connection,req.auth.adminId,'update','opportunity',opportunityId,`Updated criteria and details for ${companyName} — ${title}.`);
    }else{
      const [inserted]=await connection.execute('INSERT INTO opportunities (company_id,title,domain_id,package_lpa,location,work_mode,min_cgpa,batch_from,batch_to,application_deadline,status,job_description,extra_rules) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[cId,title,domainId,packageLpa,location,workMode,minCgpa,batchFrom,batchTo,deadline,status,description,extraRules]);
      opportunityId=inserted.insertId;
      await audit(connection,req.auth.adminId,'create','opportunity',opportunityId,`Created fictional opportunity ${companyName} — ${title}.`);
    }
    if(maxActiveBacklogs!==null)await connection.execute("INSERT INTO opportunity_eligibility_rules (opportunity_id,rule_key,rule_value) VALUES (?,'max_active_backlogs',?)",[opportunityId,maxActiveBacklogs]);
    for(const branch of branches)await connection.execute('INSERT INTO opportunity_branches (opportunity_id,branch) VALUES (?,?)',[opportunityId,branch]);
    for(const year of academicYears)await connection.execute('INSERT INTO opportunity_academic_years (opportunity_id,academic_year) VALUES (?,?)',[opportunityId,year]);
    for(const skill of cleanSkills)await connection.execute('INSERT INTO opportunity_skill_requirements (opportunity_id,skill_id,min_rating,requirement_type) VALUES (?,?,?,?)',[opportunityId,skill.id,skill.min,skill.type]);
    for(const [index,stage] of stages.entries())await connection.execute('INSERT INTO opportunity_stages (opportunity_id,stage_name,stage_order) VALUES (?,?,?)',[opportunityId,stage,index+1]);
    return opportunityId;
  });
  return companyId;
}

router.get('/opportunities',asyncRoute(async(req,res)=>{
  const items=await getOpportunityRecords(null,{includeInactive:true});
  const domains=await query('SELECT id,code,name FROM domains ORDER BY name');
  const skills=await query('SELECT id,name,category FROM skills ORDER BY category,name');
  res.json({ok:true,items,domains,skills,branches:branchCodes});
}));
router.post('/opportunities',...writeAdmin,asyncRoute(async(req,res)=>{const id=await saveOpportunity(req);res.status(201).json({ok:true,id,message:'Opportunity saved. Student eligibility is recalculated from these rules.'});}));
router.put('/opportunities/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=await saveOpportunity(req,validateId(req.params.id,'Opportunity id'));res.json({ok:true,id,message:'Opportunity rules updated.'});}));
router.delete('/opportunities/:id',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Opportunity id');
  await withTransaction(async(connection)=>{const [result]=await connection.execute("UPDATE opportunities SET status='closed' WHERE id=?",[id]);if(!result.affectedRows)throw new HttpError(404,'OPPORTUNITY_NOT_FOUND','Opportunity not found.');await audit(connection,req.auth.adminId,'close','opportunity',id,'Closed a fictional opportunity; historical applications were retained.');});
  res.json({ok:true,message:'Opportunity closed; historical application records were retained.'});
}));

router.get('/applications',asyncRoute(async(req,res)=>{
  const search=String(req.query.search||'').trim().slice(0,100);
  const status=String(req.query.status||'').trim();
  const where=[];const values=[];
  if(status){if(!appStatuses.includes(status))throw new HttpError(400,'VALIDATION_ERROR','Application status filter is invalid.');where.push('a.status=?');values.push(status);}
  if(search){where.push('(s.full_name LIKE ? OR s.enrollment_no LIKE ? OR c.name LIKE ? OR o.title LIKE ?)');values.push(...Array(4).fill(`%${search}%`));}
  const items=await query(`SELECT a.id,a.status,a.applied_at,a.updated_at,s.full_name,s.enrollment_no,s.branch,c.name AS company_name,o.title FROM applications a JOIN students s ON s.id=a.student_id JOIN opportunities o ON o.id=a.opportunity_id JOIN companies c ON c.id=o.company_id ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY a.applied_at DESC LIMIT 500`,values);
  res.json({ok:true,items,statuses:appStatuses});
}));
router.patch('/applications/:id/status',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Application id');
  const status=validateString(req.body?.status,'Status',{max:20});
  if(!appStatuses.includes(status))throw new HttpError(400,'VALIDATION_ERROR','Application status is invalid.');
  await withTransaction(async(connection)=>{const [rows]=await connection.execute('SELECT status FROM applications WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw new HttpError(404,'APPLICATION_NOT_FOUND','Application not found.');if(rows[0].status===status)return;await connection.execute('UPDATE applications SET status=? WHERE id=?',[status,id]);await connection.execute("INSERT INTO application_status_history (application_id,previous_status,new_status,changed_by_role,changed_by_admin_id,note) VALUES (?,?,?,'admin',?,'Status updated by an authorized administrator.')",[id,rows[0].status,status,req.auth.adminId]);await audit(connection,req.auth.adminId,'status_change','application',id,`Changed application status from ${rows[0].status} to ${status}.`);});
  res.json({ok:true,message:'Application status updated.'});
}));

router.get('/tests',asyncRoute(async(req,res)=>{
  const tests=await query('SELECT t.id,t.title,t.category,t.description,t.duration_minutes,t.difficulty,t.is_active,COUNT(q.id) AS question_count FROM mock_tests t LEFT JOIN test_questions q ON q.test_id=t.id AND q.is_active=TRUE GROUP BY t.id ORDER BY t.category,t.title');
  res.json({ok:true,items:tests.map((item)=>({...item,id:Number(item.id),duration_minutes:Number(item.duration_minutes),question_count:Number(item.question_count)}))});
}));
router.post('/tests',...writeAdmin,asyncRoute(async(req,res)=>{
  const title=validateString(req.body?.title,'Test title',{max:180});const category=validateString(req.body?.category,'Category',{max:80});const description=String(req.body?.description||'').trim().slice(0,500);const duration=Math.round(numeric(req.body?.durationMinutes,'Duration',{min:1,max:240}));const difficulty=req.body?.difficulty||'Beginner';if(!['Beginner','Intermediate','Advanced'].includes(difficulty))throw new HttpError(400,'VALIDATION_ERROR','Difficulty is invalid.');
  const id=await withTransaction(async(connection)=>{const [rows]=await connection.execute('INSERT INTO mock_tests (title,category,description,duration_minutes,difficulty,is_active) VALUES (?,?,?,?,?,TRUE)',[title,category,description,duration,difficulty]);await audit(connection,req.auth.adminId,'create','mock_test',rows.insertId,`Created test ${title}.`);return Number(rows.insertId);});
  res.status(201).json({ok:true,id});
}));
router.put('/tests/:id',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Test id');const title=validateString(req.body?.title,'Test title',{max:180});const category=validateString(req.body?.category,'Category',{max:80});const description=String(req.body?.description||'').trim().slice(0,500);const duration=Math.round(numeric(req.body?.durationMinutes,'Duration',{min:1,max:240}));const difficulty=req.body?.difficulty||'Beginner';if(!['Beginner','Intermediate','Advanced'].includes(difficulty))throw new HttpError(400,'VALIDATION_ERROR','Difficulty is invalid.');if(typeof req.body?.isActive!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','isActive must be true or false.');
  await withTransaction(async(connection)=>{const [existing]=await connection.execute('SELECT id FROM mock_tests WHERE id=?',[id]);if(!existing[0])throw new HttpError(404,'TEST_NOT_FOUND','Test not found.');await connection.execute('UPDATE mock_tests SET title=?,category=?,description=?,duration_minutes=?,difficulty=?,is_active=? WHERE id=?',[title,category,description,duration,difficulty,req.body.isActive,id]);await audit(connection,req.auth.adminId,'update','mock_test',id,`Updated test ${title}.`);});res.json({ok:true});
}));
router.delete('/tests/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Test id');await withTransaction(async(connection)=>{const [result]=await connection.execute('UPDATE mock_tests SET is_active=FALSE WHERE id=?',[id]);if(!result.affectedRows)throw new HttpError(404,'TEST_NOT_FOUND','Test not found.');await audit(connection,req.auth.adminId,'archive','mock_test',id,'Archived a mock test; existing attempts and results remain.');});res.json({ok:true});}));
router.get('/tests/:id/questions',asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Test id');const tests=await query('SELECT id,is_active FROM mock_tests WHERE id=?',[id]);if(!tests[0])throw new HttpError(404,'TEST_NOT_FOUND','Test not found.');const questions=await query('SELECT id,test_id,prompt,topic,explanation,question_order,is_active FROM test_questions WHERE test_id=? ORDER BY question_order',[id]);const ids=questions.map((item)=>Number(item.id));const options=ids.length?await query(`SELECT id,question_id,option_text,is_correct,option_order FROM answer_options WHERE question_id IN (${ids.map(()=>'?').join(',')}) ORDER BY option_order`,ids):[];res.json({ok:true,test:{id:Number(tests[0].id),is_active:Boolean(tests[0].is_active)},items:questions.map((item)=>({...item,id:Number(item.id),options:options.filter((option)=>Number(option.question_id)===Number(item.id)).map((option)=>({...option,id:Number(option.id),is_correct:Boolean(option.is_correct)}))}))});}));
router.post('/tests/:id/questions',...writeAdmin,asyncRoute(async(req,res)=>{
  const testId=validateId(req.params.id,'Test id');const prompt=validateString(req.body?.prompt,'Question',{max:5000});const topic=validateString(req.body?.topic,'Topic',{max:100});const explanation=validateString(req.body?.explanation,'Explanation',{max:5000});const options=req.body?.options;
  if(!Array.isArray(options)||options.length<2||options.length>6)throw new HttpError(400,'VALIDATION_ERROR','Add between 2 and 6 answer options.');
  const clean=options.map((item)=>{if(typeof item?.correct!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','Each answer option must specify a boolean correct flag.');return {text:validateString(item?.text,'Answer option',{max:500}),correct:item.correct};});if(clean.filter((item)=>item.correct).length!==1)throw new HttpError(400,'VALIDATION_ERROR','Select exactly one correct answer.');
  const id=await withTransaction(async(connection)=>{const [test]=await connection.execute('SELECT id,is_active FROM mock_tests WHERE id=?',[testId]);if(!test[0])throw new HttpError(404,'TEST_NOT_FOUND','Test not found.');if(!test[0].is_active)throw new HttpError(409,'TEST_ARCHIVED','Restore this test before adding questions.');const [orders]=await connection.execute('SELECT COALESCE(MAX(question_order),0)+1 AS next_order FROM test_questions WHERE test_id=?',[testId]);const [inserted]=await connection.execute('INSERT INTO test_questions (test_id,prompt,topic,explanation,question_order,is_active) VALUES (?,?,?,?,?,TRUE)',[testId,prompt,topic,explanation,orders[0].next_order]);for(const [index,item] of clean.entries())await connection.execute('INSERT INTO answer_options (question_id,option_text,is_correct,option_order) VALUES (?,?,?,?)',[inserted.insertId,item.text,item.correct,index+1]);await audit(connection,req.auth.adminId,'create','question',inserted.insertId,`Added a question to test ${testId}.`);return inserted.insertId;});
  res.status(201).json({ok:true,id});
}));
router.put('/questions/:id',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Question id');const prompt=validateString(req.body?.prompt,'Question',{max:5000});const topic=validateString(req.body?.topic,'Topic',{max:100});const explanation=validateString(req.body?.explanation,'Explanation',{max:5000});const options=req.body?.options;if(!Array.isArray(options)||options.length<2||options.length>6)throw new HttpError(400,'VALIDATION_ERROR','Add between 2 and 6 answer options.');const clean=options.map((item)=>{if(typeof item?.correct!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','Each answer option must specify a boolean correct flag.');return {text:validateString(item?.text,'Answer option',{max:500}),correct:item.correct};});if(clean.filter((item)=>item.correct).length!==1)throw new HttpError(400,'VALIDATION_ERROR','Select exactly one correct answer.');
  await withTransaction(async(connection)=>{const [questions]=await connection.execute('SELECT test_id,is_active FROM test_questions WHERE id=? FOR UPDATE',[id]);if(!questions[0])throw new HttpError(404,'QUESTION_NOT_FOUND','Question not found.');if(!questions[0].is_active)throw new HttpError(409,'QUESTION_ARCHIVED','Restore the question before editing it.');const [attempts]=await connection.execute('SELECT id FROM test_attempts WHERE test_id=? LIMIT 1',[questions[0].test_id]);if(attempts.length)throw new HttpError(409,'QUESTION_IN_USE','Questions cannot be edited after students have attempted this test; add a new question instead.');await connection.execute('UPDATE test_questions SET prompt=?,topic=?,explanation=? WHERE id=?',[prompt,topic,explanation,id]);await connection.execute('DELETE FROM answer_options WHERE question_id=?',[id]);for(const [index,item] of clean.entries())await connection.execute('INSERT INTO answer_options (question_id,option_text,is_correct,option_order) VALUES (?,?,?,?)',[id,item.text,item.correct,index+1]);await audit(connection,req.auth.adminId,'update','question',id,'Updated a question before any test attempts.');});res.json({ok:true});
}));
router.patch('/questions/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Question id');if(typeof req.body?.active!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','active must be true or false.');const active=req.body.active;await withTransaction(async(connection)=>{const [questions]=await connection.execute('SELECT test_id FROM test_questions WHERE id=? FOR UPDATE',[id]);if(!questions[0])throw new HttpError(404,'QUESTION_NOT_FOUND','Question not found.');const [attempts]=await connection.execute('SELECT id FROM test_attempts WHERE test_id=? LIMIT 1',[questions[0].test_id]);if(attempts.length)throw new HttpError(409,'QUESTION_IN_USE','Question availability cannot change after students have attempted this test.');await connection.execute('UPDATE test_questions SET is_active=? WHERE id=?',[active,id]);await audit(connection,req.auth.adminId,active?'restore':'archive','question',id,active?'Restored a question.':'Archived a question.');});res.json({ok:true});}));

router.get('/learning',asyncRoute(async(req,res)=>{
  const roadmaps=await query('SELECT r.id,r.domain_id,r.title,r.description,r.level,r.is_active,d.name AS domain_name,COUNT(t.id) AS topic_count FROM roadmaps r JOIN domains d ON d.id=r.domain_id LEFT JOIN roadmap_topics t ON t.roadmap_id=r.id GROUP BY r.id ORDER BY d.name,r.title');
  const topics=await query('SELECT t.id,t.roadmap_id,t.title,t.description,t.topic_order,t.difficulty,t.minutes_estimate FROM roadmap_topics t ORDER BY t.roadmap_id,t.topic_order');
  const ids=topics.map((item)=>Number(item.id));const resources=ids.length?await query(`SELECT id,topic_id,title,url,resource_type FROM learning_resources WHERE topic_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`,ids):[];
  res.json({ok:true,domains:await query('SELECT id,name FROM domains ORDER BY name'),roadmaps:roadmaps.map((item)=>({...item,id:Number(item.id),domain_id:Number(item.domain_id),is_active:Boolean(item.is_active),topic_count:Number(item.topic_count),topics:topics.filter((topic)=>Number(topic.roadmap_id)===Number(item.id)).map((topic)=>({...topic,id:Number(topic.id),resources:resources.filter((resource)=>Number(resource.topic_id)===Number(topic.id)).map((resource)=>({...resource,id:Number(resource.id)}))}))}))});
}));
router.post('/learning/roadmaps',...writeAdmin,asyncRoute(async(req,res)=>{const domainId=validateId(req.body?.domainId,'Domain id');const title=validateString(req.body?.title,'Roadmap title',{max:180});const description=String(req.body?.description||'').trim().slice(0,500);const level=validateString(req.body?.level||'Beginner to advanced','Roadmap level',{max:40});const id=await withTransaction(async(connection)=>{const [domain]=await connection.execute('SELECT id FROM domains WHERE id=?',[domainId]);if(!domain[0])throw new HttpError(404,'DOMAIN_NOT_FOUND','Career domain not found.');const [rows]=await connection.execute('INSERT INTO roadmaps (domain_id,title,description,level,is_active) VALUES (?,?,?,?,TRUE)',[domainId,title,description,level]);await audit(connection,req.auth.adminId,'create','roadmap',rows.insertId,`Created roadmap ${title}.`);return Number(rows.insertId);});res.status(201).json({ok:true,id});}));
router.put('/learning/roadmaps/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Roadmap id');const domainId=validateId(req.body?.domainId,'Domain id');const title=validateString(req.body?.title,'Roadmap title',{max:180});const description=String(req.body?.description||'').trim().slice(0,500);const level=validateString(req.body?.level||'Beginner to advanced','Roadmap level',{max:40});if(typeof req.body?.isActive!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','isActive must be true or false.');await withTransaction(async(connection)=>{const [domain]=await connection.execute('SELECT id FROM domains WHERE id=?',[domainId]);if(!domain[0])throw new HttpError(404,'DOMAIN_NOT_FOUND','Career domain not found.');const [existing]=await connection.execute('SELECT id FROM roadmaps WHERE id=?',[id]);if(!existing[0])throw new HttpError(404,'ROADMAP_NOT_FOUND','Roadmap not found.');await connection.execute('UPDATE roadmaps SET domain_id=?,title=?,description=?,level=?,is_active=? WHERE id=?',[domainId,title,description,level,req.body.isActive,id]);await audit(connection,req.auth.adminId,'update','roadmap',id,`Updated roadmap ${title}.`);});res.json({ok:true});}));
router.delete('/learning/roadmaps/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Roadmap id');await withTransaction(async(connection)=>{const [result]=await connection.execute('UPDATE roadmaps SET is_active=FALSE WHERE id=?',[id]);if(!result.affectedRows)throw new HttpError(404,'ROADMAP_NOT_FOUND','Roadmap not found.');await audit(connection,req.auth.adminId,'archive','roadmap',id,'Archived a roadmap; saved student progress was retained.');});res.json({ok:true});}));
router.post('/learning/topics',...writeAdmin,asyncRoute(async(req,res)=>{
  const roadmapId=validateId(req.body?.roadmapId,'Roadmap id');const title=validateString(req.body?.title,'Topic title',{max:180});const description=String(req.body?.description||'').trim().slice(0,500);const difficulty=req.body?.difficulty||'Beginner';if(!['Beginner','Intermediate','Advanced'].includes(difficulty))throw new HttpError(400,'VALIDATION_ERROR','Difficulty is invalid.');const minutes=Math.round(numeric(req.body?.minutesEstimate||45,'Estimated minutes',{min:5,max:1000}));const resourceTitle=String(req.body?.resourceTitle||'').trim();const rawResourceUrl=String(req.body?.resourceUrl||'').trim();const resourceUrl=rawResourceUrl?httpsResourceUrl(rawResourceUrl):'';
  const id=await withTransaction(async(connection)=>{const [roadmap]=await connection.execute('SELECT id FROM roadmaps WHERE id=?',[roadmapId]);if(!roadmap[0])throw new HttpError(404,'ROADMAP_NOT_FOUND','Roadmap not found.');const [order]=await connection.execute('SELECT COALESCE(MAX(topic_order),0)+1 AS next_order FROM roadmap_topics WHERE roadmap_id=?',[roadmapId]);const [inserted]=await connection.execute('INSERT INTO roadmap_topics (roadmap_id,title,description,difficulty,topic_order,minutes_estimate) VALUES (?,?,?,?,?,?)',[roadmapId,title,description,difficulty,order[0].next_order,minutes]);if(resourceTitle&&resourceUrl)await connection.execute('INSERT INTO learning_resources (topic_id,title,url,resource_type) VALUES (?,?,?,?)',[inserted.insertId,resourceTitle,resourceUrl,'Documentation']);await audit(connection,req.auth.adminId,'create','roadmap_topic',inserted.insertId,`Added ${title} to roadmap ${roadmapId}.`);return inserted.insertId;});
  res.status(201).json({ok:true,id});
}));
router.patch('/learning/topics/:id',...writeAdmin,asyncRoute(async(req,res)=>{
  const id=validateId(req.params.id,'Topic id');const title=validateString(req.body?.title,'Topic title',{max:180});const description=String(req.body?.description||'').trim().slice(0,500);const difficulty=req.body?.difficulty||'Beginner';if(!['Beginner','Intermediate','Advanced'].includes(difficulty))throw new HttpError(400,'VALIDATION_ERROR','Difficulty is invalid.');const minutes=Math.round(numeric(req.body?.minutesEstimate||45,'Estimated minutes',{min:5,max:1000}));
  await withTransaction(async(connection)=>{const [result]=await connection.execute('UPDATE roadmap_topics SET title=?,description=?,difficulty=?,minutes_estimate=? WHERE id=?',[title,description,difficulty,minutes,id]);if(!result.affectedRows)throw new HttpError(404,'TOPIC_NOT_FOUND','Topic not found.');await audit(connection,req.auth.adminId,'update','roadmap_topic',id,`Updated learning topic ${title}.`);});
  res.json({ok:true});
}));

router.delete('/learning/topics/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Topic id');await withTransaction(async(connection)=>{const [rows]=await connection.execute('SELECT title FROM roadmap_topics WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw new HttpError(404,'TOPIC_NOT_FOUND','Topic not found.');await connection.execute('DELETE FROM roadmap_topics WHERE id=?',[id]);await audit(connection,req.auth.adminId,'delete','roadmap_topic',id,`Deleted topic ${rows[0].title}; related resources and per-topic progress were removed.`);});res.json({ok:true});}));
router.post('/learning/resources',...writeAdmin,asyncRoute(async(req,res)=>{const topicId=validateId(req.body?.topicId,'Topic id');const title=validateString(req.body?.title,'Resource title',{max:180});const url=httpsResourceUrl(req.body?.url);const type=req.body?.resourceType||'Documentation';if(!['Documentation','Tutorial','Practice','Video'].includes(type))throw new HttpError(400,'VALIDATION_ERROR','Resource type is invalid.');const id=await withTransaction(async(connection)=>{const [topic]=await connection.execute('SELECT id FROM roadmap_topics WHERE id=?',[topicId]);if(!topic[0])throw new HttpError(404,'TOPIC_NOT_FOUND','Learning topic not found.');const [rows]=await connection.execute('INSERT INTO learning_resources (topic_id,title,url,resource_type) VALUES (?,?,?,?)',[topicId,title,url,type]);await audit(connection,req.auth.adminId,'create','learning_resource',rows.insertId,`Added resource ${title}.`);return Number(rows.insertId);});res.status(201).json({ok:true,id});}));
router.put('/learning/resources/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Resource id');const title=validateString(req.body?.title,'Resource title',{max:180});const url=httpsResourceUrl(req.body?.url);const type=req.body?.resourceType||'Documentation';if(!['Documentation','Tutorial','Practice','Video'].includes(type))throw new HttpError(400,'VALIDATION_ERROR','Resource type is invalid.');await withTransaction(async(connection)=>{const [existing]=await connection.execute('SELECT id FROM learning_resources WHERE id=?',[id]);if(!existing[0])throw new HttpError(404,'RESOURCE_NOT_FOUND','Resource not found.');await connection.execute('UPDATE learning_resources SET title=?,url=?,resource_type=? WHERE id=?',[title,url,type,id]);await audit(connection,req.auth.adminId,'update','learning_resource',id,`Updated resource ${title}.`);});res.json({ok:true});}));
router.delete('/learning/resources/:id',...writeAdmin,asyncRoute(async(req,res)=>{const id=validateId(req.params.id,'Resource id');await withTransaction(async(connection)=>{const [rows]=await connection.execute('SELECT title FROM learning_resources WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw new HttpError(404,'RESOURCE_NOT_FOUND','Resource not found.');await connection.execute('DELETE FROM learning_resources WHERE id=?',[id]);await audit(connection,req.auth.adminId,'delete','learning_resource',id,`Deleted resource ${rows[0].title}.`);});res.json({ok:true});}));
router.get('/audit',asyncRoute(async(req,res)=>{const items=await query('SELECT a.id,a.action,a.entity_type,a.entity_id,a.summary,a.created_at,ad.full_name AS admin_name FROM audit_logs a LEFT JOIN admins ad ON ad.id=a.admin_id ORDER BY a.created_at DESC LIMIT 200');res.json({ok:true,items});}));

export default router;
