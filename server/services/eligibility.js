export function evaluateEligibility({ student, opportunity, allowedBranches = [], allowedAcademicYears = [], eligibilityRules = [], studentFacts = {}, skillRequirements = [], skillRatings = new Map(), today = new Date() }) {
  const reasons = [];
  const academicReasons = [];
  const deadline = new Date(`${String(opportunity.application_deadline).slice(0,10)}T23:59:59.999Z`);
  const inactive = opportunity.status !== 'active';
  const deadlinePassed = Number.isNaN(deadline.getTime()) || deadline < today;
  if (deadlinePassed) reasons.push({ code: 'DEADLINE_PASSED', label: 'The application deadline has passed.', kind: 'deadline' });
  if (inactive) reasons.push({ code: 'OPPORTUNITY_INACTIVE', label: 'This opportunity is not currently active.', kind: 'deadline' });

  const cgpa = Number(student.cgpa);
  const cutoff = Number(opportunity.min_cgpa);
  if (cgpa < cutoff) academicReasons.push({ code: 'CGPA_BELOW_CUTOFF', label: `Your CGPA (${cgpa.toFixed(2)}) is below the ${cutoff.toFixed(2)} minimum.`, kind: 'academic' });
  const branch = String(student.branch || '').toUpperCase();
  if (allowedBranches.length && !allowedBranches.map((item) => String(item).toUpperCase()).includes(branch)) {
    academicReasons.push({ code: 'BRANCH_NOT_ELIGIBLE', label: `${branch || 'Your branch'} is not on the eligible-branch list.`, kind: 'academic' });
  }
  const batch = Number(student.batch);
  if (batch < Number(opportunity.batch_from) || batch > Number(opportunity.batch_to)) {
    academicReasons.push({ code: 'BATCH_OUT_OF_RANGE', label: `Graduation batch ${batch} is outside the ${opportunity.batch_from}–${opportunity.batch_to} range.`, kind: 'academic' });
  }
  const academicYear = String(student.academic_year || '').trim();
  if (allowedAcademicYears.length && !allowedAcademicYears.includes(academicYear)) {
    academicReasons.push({ code: 'ACADEMIC_YEAR_NOT_ELIGIBLE', label: `Academic year ${academicYear || 'not recorded'} is not in this opportunity’s allowed-year list.`, kind: 'academic' });
  }
  for (const rule of eligibilityRules) {
    if (rule.rule_key !== 'max_active_backlogs') continue;
    const maximum = Number(rule.rule_value);
    const backlogs = studentFacts.active_backlogs === null || studentFacts.active_backlogs === undefined ? NaN : Number(studentFacts.active_backlogs);
    if (!Number.isFinite(backlogs)) {
      academicReasons.push({ code: 'ACTIVE_BACKLOGS_NOT_RECORDED', label: 'An official active-backlog count is not recorded; ask an administrator to update your academic record.', kind: 'academic' });
    } else if (backlogs > maximum) {
      academicReasons.push({ code: 'ACTIVE_BACKLOG_LIMIT_EXCEEDED', label: `This role allows up to ${maximum} active backlog${maximum === 1 ? '' : 's'}; your official record lists ${backlogs}.`, kind: 'academic' });
    }
  }
  if (opportunity.extra_rules) reasons.push({ code: 'COMPANY_RULE', label: opportunity.extra_rules, kind: 'information' });
  reasons.push(...academicReasons);

  const skillGaps = [];
  for (const requirement of skillRequirements) {
    const rating = Number(skillRatings.get(Number(requirement.skill_id)) ?? skillRatings.get(String(requirement.skill_id)) ?? 0);
    if (rating < Number(requirement.min_rating)) {
      const type = requirement.requirement_type === 'required' ? 'Required' : 'Preferred';
      skillGaps.push({ skillId: Number(requirement.skill_id), skill: requirement.skill_name, requiredRating: Number(requirement.min_rating), selfRating: rating, requirementType: requirement.requirement_type, label: `${type}: ${requirement.skill_name} is rated ${rating}/10; aim for ${requirement.min_rating}/10.` });
    }
  }
  for (const gap of skillGaps) reasons.push({ code: 'SKILL_GAP', label: gap.label, kind: gap.requirementType });

  // Status precedence: deadline/inactive first, then mandatory academic criteria, then skill gaps.
  let status;
  if (deadlinePassed || inactive) status = 'Deadline Passed';
  else if (academicReasons.length) status = 'Not Eligible';
  else if (skillGaps.length) status = 'Skills Gap';
  else status = 'Eligible';

  return { status, eligible: status === 'Eligible', academicEligible: academicReasons.length === 0, reasons, skillGaps };
}
