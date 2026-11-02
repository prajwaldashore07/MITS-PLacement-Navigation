import { api } from '../api.js';
import { badge, confirmAction, dateLabel, esc, icon, percentBar, showToast } from '../components/ui.js';

export async function profileView(ctx) {
  const data = await api('/api/student/profile');
  const student = data.student;
  const activeResume = data.resume;
  const achievements = data.achievements || [];

  document.querySelector('#app').innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">Student profile</div>
        <h1>Your placement profile.</h1>
        <p>Edit your interests, self-assessments, projects, achievements and learning goals. Official academic records remain read-only.</p>
      </div>
      <span class="badge info">${data.profileCompletion}% complete</span>
    </div>
    <div class="grid-2">
      <div class="stack">
        <section class="card card-pad">
          <div class="panel-title"><div><h2>Official academic information</h2><p>Maintained by authorized administrators</p></div><span class="badge">Read-only</span></div>
          <div class="detail-grid">
            <div class="detail-item"><span>Enrollment number</span><strong class="mono">${esc(student.enrollment_no)}</strong></div>
            <div class="detail-item"><span>Branch</span><strong>${esc(student.branch)}</strong></div>
            <div class="detail-item"><span>Academic year</span><strong>${esc(student.academic_year)}</strong></div>
            <div class="detail-item"><span>Graduation batch</span><strong class="mono">${esc(student.batch)}</strong></div>
            <div class="detail-item"><span>CGPA</span><strong class="mono">${Number(student.cgpa).toFixed(2)}</strong></div>
            <div class="detail-item"><span>Active backlogs</span><strong class="mono">${student.active_backlogs===null||student.active_backlogs===undefined?'Not recorded':Number(student.active_backlogs)}</strong></div>
          </div>
        </section>
        <section class="card card-pad">
          <div class="panel-title"><div><h2>Career interests</h2><p>Saved to your student record</p></div><a class="btn secondary small-btn" href="/onboarding/interests" data-route="/onboarding/interests">Edit interests</a></div>
          <div class="filter-row">${data.interests.map((item) => `<span class="skill-chip">${esc(item.name)}</span>`).join('') || '<span class="small muted">No interests selected.</span>'}</div>
        </section>
        <section class="card card-pad">
          <div class="panel-title"><div><h2>Skills & self-assessment</h2><p>Student ratings, not verified test scores</p></div><a class="btn secondary small-btn" href="/onboarding/skills" data-route="/onboarding/skills">Edit skills</a></div>
          <div class="filter-row">${data.skills.filter((item) => item.rating > 0).map((item) => `<span class="skill-chip">${esc(item.name)} · ${item.rating}/10</span>`).concat(data.customSkills.map((item) => `<span class="skill-chip">${esc(item.name)} · ${item.rating}/10</span>`)).join('') || '<span class="small muted">No skill ratings yet.</span>'}</div>
        </section>
        <section class="card card-pad">
          <div class="panel-title"><div><h2>Resume</h2><p>Private owner-only storage</p></div>${activeResume ? badge('complete') : badge('warning')}</div>
          ${activeResume ? `<div class="row-between"><div><strong class="small">${esc(activeResume.original_name)}</strong><div class="field-help">${(Number(activeResume.size_bytes) / 1024 / 1024).toFixed(2)} MB · uploaded ${dateLabel(activeResume.uploaded_at)}</div></div><div class="row"><a class="btn secondary small-btn" href="/api/student/resume/${activeResume.id}/download?inline=1" target="_blank" rel="noopener noreferrer">Preview</a><button class="btn ghost small-btn" id="remove-resume" type="button">Remove</button></div></div><div class="field-help" style="margin-top:10px">Removal hides the resume from your active profile and future applications. Physical object erasure requires an authorized storage-operator action.</div>` : `<p class="small muted">No active resume. Upload a PDF to complete your placement profile.</p><a class="btn small-btn" href="/onboarding/resume" data-route="/onboarding/resume">Upload PDF</a>`}
        </section>
      </div>
      <div class="stack">
        <section class="card card-pad">
          <div class="panel-title"><div><h2>Profile completion</h2><p>Based on saved information in this platform</p></div><strong class="mono">${data.profileCompletion}%</strong></div>
          ${percentBar(data.profileCompletion)}
        </section>
        <form id="profile-edit-form" class="card card-pad stack">
          <div class="panel-title"><div><h2>Projects</h2><p>Work you want to discuss during recruitment.</p></div><button class="btn secondary small-btn" type="button" id="add-project">${icon('plus', 13)} Add project</button></div>
          <div id="project-list">${data.projects.map(projectRow).join('') || projectRow({})}</div>
          <div class="panel-title" style="margin-top:6px"><div><h2>Achievements</h2><p>Awards, hackathons, leadership or milestones.</p></div><button class="btn secondary small-btn" type="button" id="add-achievement">${icon('plus', 13)} Add achievement</button></div>
          <div id="achievement-list">${achievements.map(achievementRow).join('') || achievementRow({})}</div>
          <div class="panel-title" style="margin-top:6px"><div><h2>Learning goals</h2><p>Personal targets saved to your profile.</p></div><button class="btn secondary small-btn" type="button" id="add-goal">${icon('plus', 13)} Add goal</button></div>
          <div id="goal-list">${data.learningGoals.map(goalRow).join('') || goalRow({})}</div>
          <button class="btn" type="submit">Save profile changes</button>
        </form>
      </div>
    </div>`;

  document.querySelector('#add-project').addEventListener('click', () => addRow('#project-list', projectRow, 'Project'));
  document.querySelector('#add-achievement').addEventListener('click', () => addRow('#achievement-list', achievementRow, 'Achievement'));
  document.querySelector('#add-goal').addEventListener('click', () => addRow('#goal-list', goalRow, 'Learning goal'));
  document.querySelectorAll('.remove-row').forEach((button) => button.addEventListener('click', () => button.closest('.project-row,.achievement-row,.goal-row').remove()));
  document.querySelector('#profile-edit-form').addEventListener('submit', saveProfile);
  document.querySelector('#remove-resume')?.addEventListener('click', removeResume);

  function addRow(selector, render, label) {
    const list = document.querySelector(selector);
    if (list.children.length >= 12) return showToast(`Add up to 12 ${label.toLowerCase()} entries.`, 'info');
    list.insertAdjacentHTML('beforeend', render({}));
    list.lastElementChild.querySelector('.remove-row')?.addEventListener('click', (event) => event.currentTarget.closest('.project-row,.achievement-row,.goal-row').remove());
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const projects = [...form.querySelectorAll('.project-row')].map((row) => ({
      title: row.querySelector('.project-title').value.trim(),
      description: row.querySelector('.project-description').value.trim(),
      url: row.querySelector('.project-url').value.trim() || null,
    })).filter((item) => item.title || item.description);
    const savedAchievements = [...form.querySelectorAll('.achievement-row')].map((row) => ({
      title: row.querySelector('.achievement-title').value.trim(),
      description: row.querySelector('.achievement-description').value.trim(),
      achievedOn: row.querySelector('.achievement-date').value || null,
      url: row.querySelector('.achievement-url').value.trim() || null,
    })).filter((item) => item.title || item.description || item.achievedOn);
    const learningGoals = [...form.querySelectorAll('.goal-row')].map((row) => ({
      goal: row.querySelector('.goal-text').value.trim(),
      targetDate: row.querySelector('.goal-date').value || null,
    })).filter((item) => item.goal);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/student/profile', { method: 'PUT', body: { projects, achievements: savedAchievements, learningGoals } });
      showToast('Profile changes saved.', 'success');
      await profileView(ctx);
    } catch (error) {
      showToast(error.message, 'error');
      button.disabled = false;
    }
  }

  async function removeResume() {
    if (!await confirmAction({ title: 'Remove active resume?', message: 'This hides the resume record from your profile. Physical object erasure is not available through the runtime storage API.', confirmLabel: 'Remove resume', danger: true })) return;
    try {
      await api(`/api/student/resume/${activeResume.id}`, { method: 'DELETE', body: {} });
      showToast('Resume removed from your active profile.', 'success');
      await profileView(ctx);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}

function projectRow(project) {
  return `<div class="project-row card" style="padding:13px;margin-bottom:10px">
    <div class="row-between"><strong class="small">Project</strong><button type="button" class="icon-btn remove-row" aria-label="Remove project">${icon('trash', 14)}</button></div>
    <div class="field" style="margin-top:9px"><label>Title<input class="input project-title" maxlength="160" value="${esc(project.title || '')}"></label></div>
    <div class="field" style="margin-top:9px"><label>Summary<textarea class="textarea project-description" maxlength="4000" placeholder="What did you build or learn?">${esc(project.description || '')}</textarea></label></div>
    <div class="field" style="margin-top:9px"><label>Link (optional)<input class="input project-url" type="url" maxlength="500" value="${esc(project.url || '')}" placeholder="https://"></label></div>
  </div>`;
}

function achievementRow(achievement) {
  return `<div class="achievement-row card" style="padding:13px;margin-bottom:10px">
    <div class="row-between"><strong class="small">Achievement</strong><button type="button" class="icon-btn remove-row" aria-label="Remove achievement">${icon('trash', 14)}</button></div>
    <div class="field" style="margin-top:9px"><label>Title<input class="input achievement-title" maxlength="160" value="${esc(achievement.title || '')}"></label></div>
    <div class="field" style="margin-top:9px"><label>Summary<textarea class="textarea achievement-description" maxlength="4000" placeholder="What did you accomplish?">${esc(achievement.description || '')}</textarea></label></div>
    <div class="grid-2" style="margin-top:9px"><div class="field"><label>Date (optional)<input class="input achievement-date" type="date" value="${esc(achievement.achieved_on || '')}"></label></div><div class="field"><label>Link (optional)<input class="input achievement-url" type="url" maxlength="500" value="${esc(achievement.url || '')}" placeholder="https://"></label></div></div>
  </div>`;
}

function goalRow(goal) {
  return `<div class="goal-row row" style="align-items:flex-start;margin-bottom:9px">
    <label class="field" style="flex:1"><span class="visually-hidden">Learning goal</span><input class="input goal-text" maxlength="255" value="${esc(goal.goal || '')}" placeholder="e.g. Complete 20 graph problems"></label>
    <label class="field"><span class="visually-hidden">Target date</span><input class="input goal-date" type="date" value="${esc(goal.target_date ? String(goal.target_date).slice(0, 10) : '')}"></label>
    <button type="button" class="icon-btn remove-row" aria-label="Remove learning goal">${icon('trash', 14)}</button>
  </div>`;
}
