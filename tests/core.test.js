import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../server/services/eligibility.js';
import { scoreObjectiveTest } from '../server/services/scoring.js';
import { validateRating, validateId } from '../server/middleware/errors.js';

const eligibleStudent={cgpa:8.2,branch:'CSE',batch:2027};
const baseOpportunity={status:'active',application_deadline:'2099-12-31',min_cgpa:7.0,batch_from:2026,batch_to:2028,extra_rules:'Fictional demo criterion note.'};

test('eligibility accepts matching academic criteria and sufficient required skills',()=>{
  const result=evaluateEligibility({student:eligibleStudent,opportunity:baseOpportunity,allowedBranches:['CSE','ECE'],skillRequirements:[{skill_id:1,skill_name:'DSA',min_rating:5,requirement_type:'required'}],skillRatings:new Map([[1,7]]),today:new Date('2026-01-01')});
  assert.equal(result.status,'Eligible');
  assert.equal(result.academicEligible,true);
});

test('deadline precedence wins while preserving academic and skill reasons',()=>{
  const result=evaluateEligibility({student:{cgpa:5,branch:'ME',batch:2030},opportunity:{...baseOpportunity,application_deadline:'2020-01-01',min_cgpa:7,batch_from:2026,batch_to:2028},allowedBranches:['CSE'],skillRequirements:[{skill_id:4,skill_name:'Python',min_rating:5,requirement_type:'required'}],skillRatings:new Map(),today:new Date('2026-01-01')});
  assert.equal(result.status,'Deadline Passed');
  assert.ok(result.reasons.some((item)=>item.code==='CGPA_BELOW_CUTOFF'));
  assert.ok(result.reasons.some((item)=>item.code==='BRANCH_NOT_ELIGIBLE'));
  assert.ok(result.reasons.some((item)=>item.code==='BATCH_OUT_OF_RANGE'));
  assert.ok(result.reasons.some((item)=>item.code==='SKILL_GAP'));
});

test('academic mismatches take precedence over skills gaps',()=>{
  const result=evaluateEligibility({student:{cgpa:6.5,branch:'ECE',batch:2027},opportunity:baseOpportunity,allowedBranches:['CSE'],skillRequirements:[{skill_id:1,skill_name:'DSA',min_rating:7,requirement_type:'required'}],skillRatings:new Map(),today:new Date('2026-01-01')});
  assert.equal(result.status,'Not Eligible');
  assert.equal(result.academicEligible,false);
});

test('an excluded academic year is a mandatory mismatch with a clear reason',()=>{
  const result=evaluateEligibility({student:{...eligibleStudent,academic_year:'2nd year'},opportunity:baseOpportunity,allowedBranches:['CSE'],allowedAcademicYears:['4th year'],today:new Date('2026-01-01')});
  assert.equal(result.status,'Not Eligible');
  assert.ok(result.reasons.some((item)=>item.code==='ACADEMIC_YEAR_NOT_ELIGIBLE'));
});

test('a company-specific backlog limit is evaluated from official facts, and missing official facts fail closed',()=>{
  const rule=[{rule_key:'max_active_backlogs',rule_value:0}];
  const overLimit=evaluateEligibility({student:eligibleStudent,opportunity:baseOpportunity,eligibilityRules:rule,studentFacts:{active_backlogs:1},today:new Date('2026-01-01')});
  assert.equal(overLimit.status,'Not Eligible');
  assert.ok(overLimit.reasons.some((item)=>item.code==='ACTIVE_BACKLOG_LIMIT_EXCEEDED'));
  const unknown=evaluateEligibility({student:eligibleStudent,opportunity:baseOpportunity,eligibilityRules:rule,studentFacts:{active_backlogs:null},today:new Date('2026-01-01')});
  assert.equal(unknown.status,'Not Eligible');
  assert.ok(unknown.reasons.some((item)=>item.code==='ACTIVE_BACKLOGS_NOT_RECORDED'));
  const withinLimit=evaluateEligibility({student:eligibleStudent,opportunity:baseOpportunity,eligibilityRules:rule,studentFacts:{active_backlogs:0},today:new Date('2026-01-01')});
  assert.equal(withinLimit.status,'Eligible');
});

test('academically eligible student with a weak preferred skill is a skills gap',()=>{
  const result=evaluateEligibility({student:eligibleStudent,opportunity:baseOpportunity,allowedBranches:['CSE'],skillRequirements:[{skill_id:1,skill_name:'SQL',min_rating:4,requirement_type:'preferred'}],skillRatings:new Map(),today:new Date('2026-01-01')});
  assert.equal(result.status,'Skills Gap');
});

test('test scorer validates answer ownership and returns explained results only after server scoring',()=>{
  const questions=[{id:11,topic:'Arrays',explanation:'2 + 2 = 4.',options:[{id:21,is_correct:false},{id:22,is_correct:true}]}];
  const score=scoreObjectiveTest({questions,submittedAnswers:[{questionId:11,optionId:22}]});
  assert.equal(score.percentage,100);
  assert.equal(score.answers[0].isCorrect,true);
  assert.throws(()=>scoreObjectiveTest({questions,submittedAnswers:[{questionId:99,optionId:22}]}),{code:'INVALID_ANSWER'});
  assert.throws(()=>scoreObjectiveTest({questions,submittedAnswers:[{questionId:11,optionId:99}]}),{code:'INVALID_ANSWER'});
});

test('basic ID and rating validators reject invalid values',()=>{
  assert.equal(validateId('12'),12);
  assert.throws(()=>validateId('0'));
  assert.equal(validateRating(10),10);
  assert.throws(()=>validateRating(11));
});
