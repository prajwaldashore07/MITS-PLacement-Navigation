import { query } from '../db/pool.js';
import { evaluateEligibility } from './eligibility.js';

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

export async function getOpportunityRecords(ids = null, { includeInactive = false } = {}) {
  const conditions = [];
  if (ids?.length) conditions.push(`o.id IN (${ids.map(() => '?').join(',')})`);
  if (!includeInactive) conditions.push("o.status='active'");
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const base = await query(`SELECT o.id,o.company_id,o.title,o.domain_id,d.code AS domain_code,d.name AS domain_name,o.package_lpa,o.location,o.work_mode,o.min_cgpa,o.batch_from,o.batch_to,o.application_deadline,o.status,o.job_description,o.extra_rules,c.name AS company_name,c.brand_mark,c.is_demo FROM opportunities o JOIN companies c ON c.id=o.company_id JOIN domains d ON d.id=o.domain_id ${where} ORDER BY o.application_deadline ASC,o.package_lpa DESC`, ids || []);
  if (!base.length) return [];
  const idList = base.map((row) => Number(row.id));
  const marks = idList.map(() => '?').join(',');
  const [branches, academicYears, skills, stages, eligibilityRules] = await Promise.all([
    query(`SELECT opportunity_id,branch FROM opportunity_branches WHERE opportunity_id IN (${marks}) ORDER BY branch`, idList),
    query(`SELECT opportunity_id,academic_year FROM opportunity_academic_years WHERE opportunity_id IN (${marks}) ORDER BY academic_year`, idList),
    query(`SELECT r.opportunity_id,r.skill_id,s.name AS skill_name,r.min_rating,r.requirement_type FROM opportunity_skill_requirements r JOIN skills s ON s.id=r.skill_id WHERE r.opportunity_id IN (${marks}) ORDER BY s.name`, idList),
    query(`SELECT opportunity_id,stage_name,stage_order FROM opportunity_stages WHERE opportunity_id IN (${marks}) ORDER BY stage_order`, idList),
    query(`SELECT opportunity_id,rule_key,rule_value FROM opportunity_eligibility_rules WHERE opportunity_id IN (${marks}) ORDER BY rule_key`, idList),
  ]);
  const group = (rows) => rows.reduce((map, row) => { const key = Number(row.opportunity_id); if (!map.has(key)) map.set(key, []); map.get(key).push(row); return map; }, new Map());
  const branchMap = group(branches);
  const yearMap = group(academicYears);
  const skillMap = group(skills);
  const stageMap = group(stages);
  const rulesMap = group(eligibilityRules);
  return base.map((row) => ({ ...row, id: Number(row.id), company_id: Number(row.company_id), domain_id: Number(row.domain_id), package_lpa: Number(row.package_lpa), min_cgpa: Number(row.min_cgpa), batch_from: Number(row.batch_from), batch_to: Number(row.batch_to), application_deadline: dateOnly(row.application_deadline), branches: (branchMap.get(Number(row.id)) || []).map((x) => x.branch), academic_years: (yearMap.get(Number(row.id)) || []).map((x) => x.academic_year), eligibilityRules: (rulesMap.get(Number(row.id)) || []).map((x) => ({...x,rule_value:Number(x.rule_value)})), skillRequirements: skillMap.get(Number(row.id)) || [], stages: stageMap.get(Number(row.id)) || [] }));
}

export async function getSkillRatingMap(studentId) {
  const rows = await query('SELECT skill_id,rating FROM student_skills WHERE student_id = ?', [studentId]);
  const custom = await query('SELECT id,rating FROM student_custom_skills WHERE student_id = ?', [studentId]);
  const map = new Map(rows.map((row) => [Number(row.skill_id), Number(row.rating)]));
  for (const row of custom) map.set(`custom:${row.id}`, Number(row.rating));
  return map;
}

export async function attachEligibility(opportunities, student) {
  const [ratings, academicFacts] = await Promise.all([
    getSkillRatingMap(student.id),
    query('SELECT active_backlogs FROM student_academic_facts WHERE student_id=? LIMIT 1', [student.id]),
  ]);
  const studentFacts = { active_backlogs: academicFacts[0] ? Number(academicFacts[0].active_backlogs) : null };
  return opportunities.map((opportunity) => {
    const eligibility = evaluateEligibility({ student, opportunity, allowedBranches: opportunity.branches, allowedAcademicYears: opportunity.academic_years, eligibilityRules: opportunity.eligibilityRules, studentFacts, skillRequirements: opportunity.skillRequirements, skillRatings: ratings });
    return { ...opportunity, eligibility };
  });
}

export async function getOneForStudent(id, student) {
  const opportunities = await getOpportunityRecords([id]);
  if (!opportunities[0]) return null;
  return (await attachEligibility(opportunities, student))[0];
}
