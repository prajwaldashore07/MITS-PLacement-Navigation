import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncRoute, HttpError, validateId } from '../middleware/errors.js';
import { csrfGuard, requireRole } from '../middleware/session.js';

const router=Router();
router.use(requireRole('student'));

router.get('/learning',asyncRoute(async(req,res)=>{
  const interests=await query('SELECT domain_id FROM student_interests WHERE student_id=?',[req.auth.studentId]);
  const recommended=new Set(interests.map((item)=>Number(item.domain_id)));
  const roadmaps=await query('SELECT r.id,r.domain_id,r.title,r.description,r.level,d.code AS domain_code,d.name AS domain_name FROM roadmaps r JOIN domains d ON d.id=r.domain_id WHERE r.is_active=TRUE ORDER BY d.name,r.title');
  const ids=roadmaps.map((item)=>Number(item.id));
  if(!ids.length)return res.json({ok:true,roadmaps:[]});
  const placeholders=ids.map(()=>'?').join(',');
  const topics=await query(`SELECT t.id,t.roadmap_id,t.title,t.description,t.difficulty,t.topic_order,t.minutes_estimate,COALESCE(p.completed,FALSE) AS completed,p.completed_at FROM roadmap_topics t LEFT JOIN student_topic_progress p ON p.topic_id=t.id AND p.student_id=? WHERE t.roadmap_id IN (${placeholders}) ORDER BY t.roadmap_id,t.topic_order`,[req.auth.studentId,...ids]);
  const topicIds=topics.map((item)=>Number(item.id));
  const [resources,prerequisites,practiceTests]=topicIds.length?await Promise.all([
    query(`SELECT id,topic_id,title,url,resource_type FROM learning_resources WHERE topic_id IN (${topicIds.map(()=>'?').join(',')}) ORDER BY id`,topicIds),
    query(`SELECT p.topic_id,p.prerequisite_topic_id,t.title AS prerequisite_title FROM topic_prerequisites p JOIN roadmap_topics t ON t.id=p.prerequisite_topic_id WHERE p.topic_id IN (${topicIds.map(()=>'?').join(',')})`,topicIds),
    query(`SELECT p.topic_id,t.id AS test_id,t.title,t.category,t.duration_minutes,COALESCE(q.question_count,0) AS question_count,p.practice_note,p.sort_order FROM roadmap_topic_practice_tests p JOIN mock_tests t ON t.id=p.test_id LEFT JOIN (SELECT test_id,COUNT(*) AS question_count FROM test_questions WHERE is_active=TRUE GROUP BY test_id) q ON q.test_id=t.id WHERE p.topic_id IN (${topicIds.map(()=>'?').join(',')}) AND t.is_active=TRUE ORDER BY p.topic_id,p.sort_order,t.title`,topicIds),
  ]):[[],[],[]];
  const topicList=topics.map((topic)=>({...topic,id:Number(topic.id),roadmap_id:Number(topic.roadmap_id),completed:Boolean(topic.completed),minutes_estimate:Number(topic.minutes_estimate),resources:resources.filter((r)=>Number(r.topic_id)===Number(topic.id)),prerequisites:prerequisites.filter((p)=>Number(p.topic_id)===Number(topic.id)).map((p)=>({id:Number(p.prerequisite_topic_id),title:p.prerequisite_title})),practiceTests:practiceTests.filter((practice)=>Number(practice.topic_id)===Number(topic.id)).map((practice)=>({...practice,test_id:Number(practice.test_id),duration_minutes:Number(practice.duration_minutes),question_count:Number(practice.question_count)}))}));
  const result=roadmaps.map((roadmap)=>{
    const items=topicList.filter((topic)=>topic.roadmap_id===Number(roadmap.id));
    const completed=items.filter((topic)=>topic.completed).length;
    return {...roadmap,id:Number(roadmap.id),recommended:recommended.has(Number(roadmap.domain_id)),progress:{completed,total:items.length,percent:items.length?Math.round(completed/items.length*100):0},topics:items};
  }).sort((a,b)=>Number(b.recommended)-Number(a.recommended)||a.domain_name.localeCompare(b.domain_name));
  res.json({ok:true,roadmaps:result,notice:'Roadmap completion records your own progress only; it does not verify or certify external coursework.'});
}));

router.patch('/learning/topics/:id',csrfGuard,asyncRoute(async(req,res)=>{
  const topicId=validateId(req.params.id,'Topic id');
  if(typeof req.body?.completed!=='boolean')throw new HttpError(400,'VALIDATION_ERROR','completed must be true or false.');
  await withTransaction(async(connection)=>{
    const [topics]=await connection.execute('SELECT id FROM roadmap_topics WHERE id=?',[topicId]);
    if(!topics[0])throw new HttpError(404,'TOPIC_NOT_FOUND','Learning topic not found.');
    if(req.body.completed){
      const [prereqs]=await connection.execute('SELECT prerequisite_topic_id FROM topic_prerequisites WHERE topic_id=?',[topicId]);
      if(prereqs.length){const ids=prereqs.map((item)=>item.prerequisite_topic_id);const [done]=await connection.execute(`SELECT topic_id FROM student_topic_progress WHERE student_id=? AND completed=TRUE AND topic_id IN (${ids.map(()=>'?').join(',')})`,[req.auth.studentId,...ids]);if(done.length!==ids.length)throw new HttpError(409,'PREREQUISITES_INCOMPLETE','Complete the earlier roadmap topic before marking this one done.');}
    }
    await connection.execute('INSERT INTO student_topic_progress (student_id,topic_id,completed,completed_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE completed=VALUES(completed),completed_at=VALUES(completed_at)',[req.auth.studentId,topicId,req.body.completed,req.body.completed?new Date():null]);
  });
  res.json({ok:true,completed:req.body.completed});
}));

export default router;
