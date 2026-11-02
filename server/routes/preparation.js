import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncRoute, HttpError, validateId } from '../middleware/errors.js';
import { csrfGuard, requireRole } from '../middleware/session.js';
import { scoreObjectiveTest } from '../services/scoring.js';
import { getOneForStudent } from '../services/opportunities.js';

const router = Router();
router.use(requireRole('student'));
const domainCategories = {
  SDE: ['DSA and coding','Core CS fundamentals','Technical MCQs','Technical interviews','HR interviews'],
  WEB: ['Technical MCQs','DSA and coding','Technical interviews','HR interviews'],
  ANALYTICS: ['Quantitative aptitude','Technical MCQs','Logical reasoning','HR interviews'],
  AIML: ['DSA and coding','Quantitative aptitude','Technical MCQs','Technical interviews'],
  CORE_ETE: ['Domain-specific ETE','Technical MCQs','Logical reasoning','Technical interviews'],
  EMBEDDED: ['Domain-specific ETE','Technical MCQs','Logical reasoning','Technical interviews'],
  OTHER: ['Quantitative aptitude','Logical reasoning','Verbal ability','Technical MCQs','HR interviews'],
};

async function loadQuestions(testId, includeCorrect = false) {
  const questions = await query('SELECT id,test_id,prompt,topic,explanation,question_order FROM test_questions WHERE test_id=? AND is_active=TRUE ORDER BY question_order', [testId]);
  const ids = questions.map((item) => Number(item.id));
  if (!ids.length) return [];
  const options = await query(`SELECT id,question_id,option_text,${includeCorrect ? 'is_correct' : 'FALSE AS is_correct'},option_order FROM answer_options WHERE question_id IN (${ids.map(() => '?').join(',')}) ORDER BY option_order`, ids);
  const map = new Map();
  for (const option of options) {
    const key = Number(option.question_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...option, id: Number(option.id), is_correct: Boolean(option.is_correct) });
  }
  return questions.map((item) => ({ ...item, id: Number(item.id), options: map.get(Number(item.id)) || [] }));
}

router.get('/preparation/recommendations', asyncRoute(async (req,res)=>{
  let opportunity=null;let domain=null;let items=[];
  if(req.query.opportunityId){
    const id=validateId(req.query.opportunityId,'Opportunity id');
    opportunity=await getOneForStudent(id,req.auth.student);
    if(!opportunity)throw new HttpError(404,'OPPORTUNITY_NOT_FOUND','That active demonstration opportunity was not found.');
    items=await query(`SELECT r.test_id,t.title,t.category,t.description,t.duration_minutes,t.difficulty,r.recommendation_note,r.sort_order,COALESCE(q.question_count,0) AS question_count FROM opportunity_test_recommendations r JOIN mock_tests t ON t.id=r.test_id LEFT JOIN (SELECT test_id,COUNT(*) AS question_count FROM test_questions WHERE is_active=TRUE GROUP BY test_id) q ON q.test_id=t.id WHERE r.opportunity_id=? AND t.is_active=TRUE ORDER BY r.sort_order,t.title`,[id]);
  }else{
    const code=String(req.query.domain||'').trim().toUpperCase();
    if(!code)throw new HttpError(400,'VALIDATION_ERROR','Provide an opportunityId or domain to request recommendations.');
    const domains=await query('SELECT code,name FROM domains WHERE code=? LIMIT 1',[code]);
    if(!domains[0])throw new HttpError(404,'DOMAIN_NOT_FOUND','That career domain was not found.');
    domain=domains[0];
    const categories=domainCategories[code]||domainCategories.OTHER;
    items=await query(`SELECT t.id AS test_id,t.title,t.category,t.description,t.duration_minutes,t.difficulty,COALESCE(q.question_count,0) AS question_count FROM mock_tests t LEFT JOIN (SELECT test_id,COUNT(*) AS question_count FROM test_questions WHERE is_active=TRUE GROUP BY test_id) q ON q.test_id=t.id WHERE t.is_active=TRUE AND t.category IN (${categories.map(()=>'?').join(',')}) ORDER BY t.category,t.title`,categories);
    items=items.map((item,index)=>({...item,recommendation_note:`${domain.name} practice priority ${index+1}: use this short timed set to strengthen a related placement skill.`,sort_order:index+1}));
  }
  res.json({ok:true,opportunity:opportunity?{id:opportunity.id,company_name:opportunity.company_name,title:opportunity.title,domain_code:opportunity.domain_code,domain_name:opportunity.domain_name}:null,domain,items:items.map((item)=>({...item,test_id:Number(item.test_id),duration_minutes:Number(item.duration_minutes),question_count:Number(item.question_count),sort_order:Number(item.sort_order)}))});
}));

router.get('/preparation/tests', asyncRoute(async (req, res) => {
  const tests = await query('SELECT t.id,t.title,t.category,t.description,t.duration_minutes,t.difficulty,COUNT(q.id) AS question_count FROM mock_tests t LEFT JOIN test_questions q ON q.test_id=t.id AND q.is_active=TRUE WHERE t.is_active=TRUE GROUP BY t.id ORDER BY t.category,t.title');
  const attempts = await query('SELECT id,test_id,status,score,total_questions,started_at,submitted_at FROM test_attempts WHERE student_id=? ORDER BY started_at DESC LIMIT 12', [req.auth.studentId]);
  const activeByTest = new Map(attempts.filter((attempt) => attempt.status === 'in_progress').map((attempt) => [Number(attempt.test_id), Number(attempt.id)]));
  res.json({ ok: true, tests: tests.map((item) => ({ ...item, id: Number(item.id), duration_minutes: Number(item.duration_minutes), question_count: Number(item.question_count), attempt_in_progress: activeByTest.has(Number(item.id)), active_attempt_id: activeByTest.get(Number(item.id)) || null })), attempts: attempts.map((item) => ({ ...item, id: Number(item.id), test_id: Number(item.test_id), score: item.score === null ? null : Number(item.score), total_questions: Number(item.total_questions) })) });
}));

router.get('/tests/:id', asyncRoute(async (req, res) => {
  const id = validateId(req.params.id, 'Test id');
  const testRows = await query('SELECT id,title,category,description,duration_minutes,difficulty FROM mock_tests WHERE id=? AND is_active=TRUE LIMIT 1', [id]);
  if (!testRows[0]) throw new HttpError(404, 'TEST_NOT_FOUND', 'That mock test is not available.');
  const questions = await loadQuestions(id, false);
  res.json({ ok: true, test: { ...testRows[0], id: Number(testRows[0].id), duration_minutes: Number(testRows[0].duration_minutes) }, questions: questions.map(({ explanation, ...question }) => question), notice: 'Correct answers and explanations are shown only after submission.' });
}));

router.post('/tests/:id/attempts', csrfGuard, asyncRoute(async (req, res) => {
  const testId = validateId(req.params.id, 'Test id');
  const attempt = await withTransaction(async (connection) => {
    const [testRows] = await connection.execute('SELECT id,duration_minutes FROM mock_tests WHERE id=? AND is_active=TRUE LIMIT 1 FOR UPDATE', [testId]);
    if (!testRows[0]) throw new HttpError(404, 'TEST_NOT_FOUND', 'That mock test is not available.');
    const questions = await loadQuestions(testId, false);
    if (!questions.length) throw new HttpError(409, 'TEST_EMPTY', 'This test does not have any active questions.');
    const [existing] = await connection.execute("SELECT id,started_at,expires_at FROM test_attempts WHERE student_id=? AND test_id=? AND status='in_progress' ORDER BY started_at DESC LIMIT 1", [req.auth.studentId, testId]);
    if (existing[0]) return { attemptId: Number(existing[0].id), startedAt: existing[0].started_at, expiresAt: existing[0].expires_at, questions, resumed: true };
    const started = new Date();
    const expires = new Date(started.getTime() + Number(testRows[0].duration_minutes) * 60 * 1000);
    const [result] = await connection.execute("INSERT INTO test_attempts (student_id,test_id,status,started_at,expires_at,total_questions) VALUES (?,?,'in_progress',?,?,?)", [req.auth.studentId, testId, started, expires, questions.length]);
    return { attemptId: Number(result.insertId), startedAt: started, expiresAt: expires, questions, resumed: false };
  });
  res.status(attempt.resumed ? 200 : 201).json({ ok: true, attemptId: attempt.attemptId, startedAt: new Date(attempt.startedAt).toISOString(), expiresAt: new Date(attempt.expiresAt).toISOString(), questions: attempt.questions.map(({ explanation, ...question }) => question), resumed: attempt.resumed });
}));

router.get('/attempts/:id', asyncRoute(async (req, res) => {
  const attemptId = validateId(req.params.id, 'Attempt id');
  const rows = await query('SELECT a.id,a.test_id,a.status,a.started_at,a.expires_at,t.title,t.category,t.description,t.duration_minutes,t.difficulty FROM test_attempts a JOIN mock_tests t ON t.id=a.test_id WHERE a.id=? AND a.student_id=? LIMIT 1', [attemptId, req.auth.studentId]);
  const attempt = rows[0];
  if (!attempt) throw new HttpError(404, 'ATTEMPT_NOT_FOUND', 'Test attempt not found.');
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'ATTEMPT_CLOSED', 'This test attempt has already been submitted.');
  const questions = await loadQuestions(Number(attempt.test_id), false);
  if (!questions.length) throw new HttpError(409, 'TEST_EMPTY', 'This test no longer has active questions.');
  const saved = await query('SELECT question_id,answer_option_id FROM test_attempt_answers WHERE attempt_id=?', [attemptId]);
  res.json({ ok: true, attemptId, attemptStatus: attempt.status, startedAt: attempt.started_at, expiresAt: attempt.expires_at, test: { id: Number(attempt.test_id), title: attempt.title, category: attempt.category, description: attempt.description, duration_minutes: Number(attempt.duration_minutes), difficulty: attempt.difficulty }, questions: questions.map(({ explanation, ...question }) => question), savedAnswers: saved.map((item) => ({ questionId: Number(item.question_id), optionId: item.answer_option_id === null ? null : Number(item.answer_option_id) })) });
}));

router.put('/attempts/:id/answers', csrfGuard, asyncRoute(async (req, res) => {
  const attemptId = validateId(req.params.id, 'Attempt id');
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length > 100) throw new HttpError(400, 'VALIDATION_ERROR', 'Answers must be a list.');
  await withTransaction(async (connection) => {
    const [attemptRows] = await connection.execute('SELECT id,test_id,status,expires_at FROM test_attempts WHERE id=? AND student_id=? FOR UPDATE', [attemptId, req.auth.studentId]);
    const attempt = attemptRows[0];
    if (!attempt) throw new HttpError(404, 'ATTEMPT_NOT_FOUND', 'Test attempt not found.');
    if (attempt.status !== 'in_progress') throw new HttpError(409, 'ATTEMPT_CLOSED', 'This test attempt is already closed.');
    if (new Date(attempt.expires_at) < new Date()) throw new HttpError(409, 'TIME_EXPIRED', 'The test time has expired. Submit the attempt to review your result.');
    const questions = await loadQuestions(Number(attempt.test_id), false);
    const scored = scoreObjectiveTest({ questions, submittedAnswers: answers });
    for (const answer of scored.answers) await connection.execute('INSERT INTO test_attempt_answers (attempt_id,question_id,answer_option_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE answer_option_id=VALUES(answer_option_id)', [attemptId, answer.questionId, answer.selectedOptionId]);
  });
  res.json({ ok: true, saved: true });
}));

router.post('/attempts/:id/submit', csrfGuard, asyncRoute(async (req, res) => {
  const attemptId = validateId(req.params.id, 'Attempt id');
  const result = await withTransaction(async (connection) => {
    const [attemptRows] = await connection.execute('SELECT id,test_id,status,expires_at FROM test_attempts WHERE id=? AND student_id=? FOR UPDATE', [attemptId, req.auth.studentId]);
    const attempt = attemptRows[0];
    if (!attempt) throw new HttpError(404, 'ATTEMPT_NOT_FOUND', 'Test attempt not found.');
    if (attempt.status !== 'in_progress') throw new HttpError(409, 'ATTEMPT_CLOSED', 'This test attempt has already been submitted.');
    const questions = await loadQuestions(Number(attempt.test_id), true);
    const saved = await query('SELECT question_id,answer_option_id FROM test_attempt_answers WHERE attempt_id=?', [attemptId]);
    const answers = saved.map((row) => ({ questionId: Number(row.question_id), optionId: row.answer_option_id === null ? null : Number(row.answer_option_id) }));
    const scored = scoreObjectiveTest({ questions, submittedAnswers: answers });
    for (const answer of scored.answers) await connection.execute('INSERT INTO test_attempt_answers (attempt_id,question_id,answer_option_id,is_correct) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE answer_option_id=VALUES(answer_option_id),is_correct=VALUES(is_correct)', [attemptId, answer.questionId, answer.selectedOptionId, answer.isCorrect]);
    const expired = new Date(attempt.expires_at) < new Date();
    await connection.execute('UPDATE test_attempts SET status=?,submitted_at=NOW(),score=? WHERE id=?', [expired ? 'expired' : 'submitted', scored.percentage, attemptId]);
    return { ...scored, expired };
  });
  res.json({ ok: true, resultUrl: `/attempts/${attemptId}/results`, expired: result.expired, correctCount: result.correctCount, total: result.total, percentage: result.percentage });
}));

router.get('/attempts/:id/results', asyncRoute(async (req, res) => {
  const attemptId = validateId(req.params.id, 'Attempt id');
  const rows = await query('SELECT a.id,a.status,a.score,a.total_questions,a.started_at,a.submitted_at,t.id AS test_id,t.title,t.category FROM test_attempts a JOIN mock_tests t ON t.id=a.test_id WHERE a.id=? AND a.student_id=? LIMIT 1', [attemptId, req.auth.studentId]);
  const attempt = rows[0];
  if (!attempt) throw new HttpError(404, 'ATTEMPT_NOT_FOUND', 'Test attempt not found.');
  if (attempt.status === 'in_progress') throw new HttpError(409, 'RESULT_NOT_READY', 'Submit the test before viewing correct answers.');
  const questions = await loadQuestions(Number(attempt.test_id), true);
  const answers = await query('SELECT question_id,answer_option_id,is_correct FROM test_attempt_answers WHERE attempt_id=?', [attemptId]);
  const answersByQuestion = new Map(answers.map((item) => [Number(item.question_id), item]));
  const results = questions.map((question) => {
    const saved = answersByQuestion.get(question.id);
    const selectedId = saved?.answer_option_id === null ? null : Number(saved?.answer_option_id);
    return { ...question, selectedOptionId: selectedId, correctOptionId: Number(question.options.find((option) => option.is_correct)?.id), isCorrect: Boolean(saved?.is_correct), options: question.options.map(({ is_correct, ...option }) => option) };
  });
  const topicMap = new Map();
  for (const item of results) {
    if (!topicMap.has(item.topic)) topicMap.set(item.topic, { topic: item.topic, correct: 0, total: 0 });
    const group = topicMap.get(item.topic);
    group.total++;
    if (item.isCorrect) group.correct++;
  }
  res.json({ ok: true, attempt: { ...attempt, score: Number(attempt.score), total_questions: Number(attempt.total_questions) }, questions: results, topicPerformance: [...topicMap.values()].map((item) => ({ ...item, percent: Math.round(item.correct / item.total * 100) })), recommendation: results.some((item) => !item.isCorrect) ? 'Review the explanations for missed questions, then revisit a related learning topic.' : 'Strong attempt. Try a higher-difficulty set or apply the ideas to a new problem.' });
}));

export default router;
