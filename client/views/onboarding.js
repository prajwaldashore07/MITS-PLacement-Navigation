import { api, uploadFile } from '../api.js';
import { brandMark, confirmAction, esc, icon, percentBar, showToast } from '../components/ui.js';

const stepInfo = [['interests', 'Career interests'], ['skills', 'Skill self-assessment'], ['resume', 'Resume & summary']];

function frame(step, body) {
  const index = stepInfo.findIndex(([key]) => key === step);
  const steps = stepInfo.map(([key, label], i) => `<div class="step ${i === index ? 'active' : i < index ? 'done' : ''}"><span class="step-number">${i < index ? icon('check', 12) : i + 1}</span><span class="step-label">${label}</span></div>${i < stepInfo.length - 1 ? '<span class="step-line"></span>' : ''}`).join('');
  return `<div class="onboarding-shell"><aside class="onboarding-aside"><div class="brand">${brandMark()}<div><div class="brand-name">MITS Placement</div><div class="brand-caption">Navigation platform</div></div></div><div><div class="eyebrow" style="color:#b5c1e2">Your placement workspace</div><h1>Build a profile that moves with your goals.</h1><p>Make your interests and strengths visible so you can focus on roles and preparation that fit.</p></div><div class="onboarding-aside-foot">Fictional demonstration student records</div></aside><main class="onboarding-main"><div class="onboarding-progress"><div class="steps">${steps}</div></div><section class="onboarding-body">${body}</section></main></div>`;
}

function proficiency(value) {
  if (value <= 2) return 'Getting started';
  if (value <= 4) return 'Building basics';
  if (value <= 6) return 'Developing';
  if (value <= 8) return 'Confident';
  return 'Advanced self-rating';
}

export async function interestsView(ctx) {
  const data = await api('/api/student/onboarding');
  const chosen = new Set(data.interests.map((item) => Number(item.id)));
  const descriptions = {
    SDE: 'Algorithms, software systems and engineering.', WEB: 'Interfaces, applications and web APIs.',
    ANALYTICS: 'SQL, spreadsheets, statistics and insights.', AIML: 'Python, models and machine-learning basics.',
    CORE_ETE: 'Electronics, circuits and communication systems.', EMBEDDED: 'Firmware, microcontrollers and connected devices.',
    OTHER: 'Explore a different or interdisciplinary path.',
  };
  document.querySelector('#app').innerHTML = frame('interests', `<div class="eyebrow">Step 1 of 3 · Career direction</div><h2>Which paths interest you?</h2><p>Select one or more areas. You can update these choices later in your profile.</p><div class="domain-grid" id="domain-grid">${data.domains.map((domain) => `<button class="domain-card ${chosen.has(Number(domain.id)) ? 'selected' : ''}" type="button" data-domain-id="${domain.id}" aria-pressed="${chosen.has(Number(domain.id))}"><span class="domain-icon">${icon(domain.icon, 18)}</span><span><strong>${esc(domain.name)}</strong><small>${esc(descriptions[domain.code] || domain.description)}</small></span></button>`).join('')}</div><div class="row-between" style="margin-top:24px"><a class="btn ghost" href="/dashboard" data-route="/dashboard">Back</a><button class="btn" type="button" id="continue-interests">Continue ${icon('arrow', 15)}</button></div>`);
  const grid = document.querySelector('#domain-grid');
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-domain-id]');
    if (!button) return;
    const id = Number(button.dataset.domainId);
    if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
    button.classList.toggle('selected', chosen.has(id));
    button.setAttribute('aria-pressed', String(chosen.has(id)));
  });
  document.querySelector('#continue-interests').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    if (!chosen.size) { showToast('Choose at least one interest to continue.', 'error'); button.disabled = false; return; }
    try {
      await api('/api/student/interests', { method: 'PUT', body: { domainIds: [...chosen] } });
      await ctx.refreshSession();
      ctx.navigate('/onboarding/skills');
    } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
  });
}

export async function skillsView(ctx) {
  const data = await api('/api/student/onboarding');
  const interestIds = new Set(data.interests.map((item) => Number(item.id)));
  const selected = new Map(data.skills.filter((skill) => skill.selected).map((skill) => [Number(skill.id), Number(skill.rating)]));
  const custom = data.customSkills.map((skill) => ({ ...skill, rating: Number(skill.rating) }));
  const relevant = data.skills.filter((skill) => skill.domainIds.some((id) => interestIds.has(Number(id))));
  const ordered = [...relevant, ...data.skills.filter((skill) => !relevant.includes(skill))];

  function updateSummary() {
    const values = [...selected.values(), ...custom.map((item) => Number(item.rating))];
    const summary = document.querySelector('#skill-summary');
    if (!summary) return;
    if (!values.length) { summary.innerHTML = '<p class="small muted">Add a skill and set your current rating to see a summary.</p>'; return; }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    summary.innerHTML = `${percentBar(Math.round(average * 10))}<p class="small muted" style="margin:10px 0 0">${values.length} skills selected · average self-rating ${average.toFixed(1)}/10. These are not verified test scores.</p>`;
  }

  function render() {
    const makeSkill = (skill) => {
      const id = Number(skill.id);
      const isSelected = selected.has(id);
      const rating = selected.get(id) ?? 0;
      return `<article class="skill-card" data-skill-card="${id}"><div class="row-between"><div><h3>${esc(skill.name)}</h3><p>${esc(skill.category)}${skill.domainIds.some((domainId) => interestIds.has(Number(domainId))) ? ' · Recommended' : ''}</p></div><button class="btn ${isSelected ? 'secondary' : ''} small-btn" type="button" data-skill-toggle="${id}" aria-pressed="${isSelected}">${isSelected ? 'Remove' : 'Add skill'}</button></div>${isSelected ? `<label class="field-help" for="skill-rating-${id}">Self-rating · ${proficiency(rating)}</label><div class="skill-rate-row"><input type="range" id="skill-rating-${id}" min="0" max="10" value="${rating}" data-skill-rating="${id}" aria-label="Self-assessed ${esc(skill.name)} proficiency from 0 to 10"><span class="rating-value" data-rating-label="${id}">${rating}/10</span></div>` : ''}</article>`;
    };
    const makeCustom = (skill, index) => `<article class="skill-card" data-custom-card="${index}"><div class="row-between"><div><h3>${esc(skill.name)}</h3><p>${esc(skill.category)} · Custom skill</p></div><button class="icon-btn" type="button" data-custom-remove="${index}" aria-label="Remove ${esc(skill.name)}">${icon('trash', 15)}</button></div><label class="field-help" for="custom-rating-${index}">Self-rating · ${proficiency(skill.rating)}</label><div class="skill-rate-row"><input type="range" id="custom-rating-${index}" min="0" max="10" value="${skill.rating}" data-custom-rating="${index}" aria-label="Self-assessed ${esc(skill.name)} proficiency from 0 to 10"><span class="rating-value" data-custom-label="${index}">${skill.rating}/10</span></div></article>`;
    const skillCount = selected.size + custom.length;
    document.querySelector('#app').innerHTML = frame('skills', `<div class="eyebrow">Step 2 of 3 · Your current strengths</div><h2>Rate the skills you have today.</h2><p>These are student self-assessments—not verified test scores. Start with skills related to your chosen paths; you can add, remove or adjust them later.</p><div class="grid-2 equal"><section><div class="panel-title"><div><h3>Recommended skills</h3><p>Based on your career interests</p></div><span class="badge info">${relevant.length} suggested</span></div><div class="stack" id="skill-list">${ordered.map(makeSkill).join('')}</div></section><aside class="stack"><div class="card card-pad"><div class="panel-title"><div><h3>Skill summary</h3><p>Based on your ratings</p></div></div><div id="skill-summary">${skillCount ? `${percentBar(Math.round(([...selected.values(), ...custom.map((item) => item.rating)].reduce((a, b) => a + b, 0) / Math.max(1, skillCount)) * 10))}<p class="small muted" style="margin:10px 0 0">${skillCount} skills selected · student self-assessment</p>` : '<p class="small muted">Add a skill and set your current rating to see a summary.</p>'}</div></div><div class="card card-pad"><div class="panel-title"><div><h3>Add another skill</h3><p>Create a profile-specific skill entry</p></div></div><form id="custom-skill-form" class="stack"><div class="field"><label for="custom-skill-name">Skill name</label><input class="input" id="custom-skill-name" maxlength="80" required placeholder="e.g. Technical writing"></div><div class="field"><label for="custom-skill-category">Category</label><input class="input" id="custom-skill-category" maxlength="60" value="Other" required></div><div class="field"><label for="custom-skill-rating">Self-rating: <span id="new-custom-rating-label">5</span>/10</label><input class="input" id="custom-skill-rating" type="range" min="0" max="10" value="5"></div><button class="btn secondary" type="submit">${icon('plus', 15)} Add custom skill</button></form></div></aside></div><div class="grid-2 equal" style="margin-top:16px"><section class="stack" id="custom-skill-list">${custom.length ? custom.map(makeCustom).join('') : '<p class="small muted">No custom skills added yet.</p>'}</section><div></div></div><div class="row-between" style="margin-top:24px"><a class="btn ghost" href="/onboarding/interests" data-route="/onboarding/interests">${icon('back', 15)} Back</a><button class="btn" type="button" id="continue-skills">Save & continue ${icon('arrow', 15)}</button></div>`);
    document.querySelector('#skill-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-skill-toggle]');
      if (!button) return;
      const id = Number(button.dataset.skillToggle);
      if (selected.has(id)) selected.delete(id); else selected.set(id, 0);
      render();
    });
    document.querySelectorAll('[data-skill-rating]').forEach((input) => input.addEventListener('input', () => {
      const id = Number(input.dataset.skillRating);
      const rating = Number(input.value);
      selected.set(id, rating);
      const label = document.querySelector(`[data-rating-label="${id}"]`);
      if (label) label.textContent = `${rating}/10`;
      input.closest('.skill-card').querySelector('.field-help').textContent = `Self-rating · ${proficiency(rating)}`;
      updateSummary();
    }));
    document.querySelector('#custom-skill-rating').addEventListener('input', (event) => { document.querySelector('#new-custom-rating-label').textContent = event.target.value; });
    document.querySelector('#custom-skill-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.querySelector('#custom-skill-name').value.trim();
      if (!name) return;
      if (custom.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) { showToast('That custom skill is already listed.', 'error'); return; }
      custom.push({ name, category: document.querySelector('#custom-skill-category').value.trim() || 'Other', rating: Number(document.querySelector('#custom-skill-rating').value) });
      render();
    });
    document.querySelectorAll('[data-custom-rating]').forEach((input) => input.addEventListener('input', () => {
      const index = Number(input.dataset.customRating);
      custom[index].rating = Number(input.value);
      document.querySelector(`[data-custom-label="${index}"]`).textContent = `${input.value}/10`;
      updateSummary();
    }));
    document.querySelectorAll('[data-custom-remove]').forEach((button) => button.addEventListener('click', () => { custom.splice(Number(button.dataset.customRemove), 1); render(); }));
    document.querySelector('#continue-skills').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api('/api/student/skills', { method: 'PUT', body: { skills: [...selected].map(([id, rating]) => ({ id, rating })), customSkills: custom } });
        await ctx.refreshSession();
        ctx.navigate('/onboarding/resume');
      } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
    });
  }
  render();
}

export async function resumeView(ctx) {
  const data = await api('/api/student/onboarding');
  const student = data.student;
  const resume = data.resume;
  const size = resume ? `${(Number(resume.size_bytes) / 1024 / 1024).toFixed(2)} MB` : 'PDF · maximum 5 MB';
  const interests = data.interests.map((item) => item.name).join(', ') || 'Not selected';
  const selectedSkills = data.skills.filter((item) => item.selected).map((item) => `${item.name} ${item.rating}/10`).concat(data.customSkills.map((item) => `${item.name} ${item.rating}/10`));
  const summary = resume ? `<div class="card card-pad stack"><div class="row-between"><div><div class="eyebrow">Profile summary</div><h3 style="margin:0">Ready for your placement workspace</h3></div><span class="badge complete">Resume on file</span></div><div class="detail-grid"><div class="detail-item"><span>Student</span><strong>${esc(student.full_name)}</strong></div><div class="detail-item"><span>Enrollment</span><strong class="mono">${esc(student.enrollment_no)}</strong></div><div class="detail-item"><span>Branch · year</span><strong>${esc(student.branch)} · ${esc(student.academic_year)}</strong></div><div class="detail-item"><span>Graduation batch · CGPA</span><strong>${esc(student.batch)} · ${Number(student.cgpa).toFixed(2)}</strong></div></div><div><div class="field-help">Career interests</div><p class="small" style="margin:5px 0 12px">${esc(interests)}</p><div class="field-help">Self-assessed skills</div><div class="filter-row" style="margin-top:6px">${selectedSkills.slice(0, 12).map((item) => `<span class="skill-chip">${esc(item)}</span>`).join('') || '<span class="small muted">No skills rated yet.</span>'}</div></div><div class="row-between"><div><strong class="small">${esc(resume.original_name)}</strong><div class="field-help">${esc(size)} · private owner-only storage</div></div><div class="row"><a class="btn secondary small-btn" href="/api/student/resume/${resume.id}/download?inline=1" target="_blank" rel="noopener">Preview PDF</a><button type="button" class="btn ghost small-btn" id="remove-resume">Remove</button></div></div></div>` : '<div class="card card-pad"><div class="alert warning">Upload your PDF resume to complete onboarding and view the profile summary.</div></div>';
  document.querySelector('#app').innerHTML = frame('resume', `<div class="eyebrow">Step 3 of 3 · Resume and review</div><h2>Add your resume.</h2><p>Upload a PDF to keep your placement profile ready. Your resume is stored privately and is not exposed through a public URL.</p>${resume ? `<div class="alert" style="margin-bottom:16px">Current resume: <strong>${esc(resume.original_name)}</strong> · ${esc(size)}</div>` : ''}<form id="resume-form"><label class="upload-zone" id="upload-zone" for="resume-file" tabindex="0" role="button" aria-label="Choose a PDF resume"><span>${icon('upload', 28)}</span><h3>Drop your PDF here, or browse files</h3><p>PDF only · maximum 5 MB</p><input class="sr-only" type="file" id="resume-file" accept="application/pdf,.pdf" aria-label="Choose PDF resume"></label><div id="resume-file-name" class="small muted" style="margin-top:8px"></div><div id="resume-error" class="login-error" role="alert"></div><div id="upload-progress" class="progress-track" role="progressbar" aria-label="Resume upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden style="margin-top:10px"><div class="progress-fill" id="upload-progress-fill" style="width:0%"></div></div><div id="upload-progress-label" class="field-help" aria-live="polite"></div><div class="row-between" style="margin-top:16px"><a class="btn ghost" href="/onboarding/skills" data-route="/onboarding/skills">${icon('back', 15)} Back</a><button class="btn" type="submit" id="resume-upload" ${!resume ? 'disabled' : ''}>${resume ? 'Continue to dashboard' : 'Upload PDF'}</button></div></form><div style="margin-top:22px" id="resume-summary">${summary}</div><p class="field-help" style="margin-top:12px">Removing a resume hides it from your profile; physical erasure requires an authorized storage-operator action.</p>`);

  const form = document.querySelector('#resume-form');
  const fileInput = document.querySelector('#resume-file');
  const zone = document.querySelector('#upload-zone');
  const button = document.querySelector('#resume-upload');
  const error = document.querySelector('#resume-error');
  let selectedFile = null;
  function setFile(file) {
    if (!file) return;
    selectedFile = file;
    document.querySelector('#resume-file-name').textContent = `Selected: ${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    button.disabled = false;
    button.textContent = 'Upload PDF';
    error.textContent = '';
  }
  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0]));
  zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('dragover'); setFile(event.dataTransfer.files?.[0]); });
  zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedFile) { if (resume) { ctx.navigate('/dashboard'); return; } error.textContent = 'Choose a PDF file first.'; return; }
    if (selectedFile.type !== 'application/pdf' || !selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.size > 5 * 1024 * 1024) { error.textContent = 'Choose a valid PDF under 5 MB.'; return; }
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Uploading securely';
    const progress = document.querySelector('#upload-progress');
    const progressFill = document.querySelector('#upload-progress-fill');
    const progressLabel = document.querySelector('#upload-progress-label');
    progress.hidden = false;
    try {
      const payload = await uploadFile('/api/student/resume', selectedFile, (percent) => {
        progress.setAttribute('aria-valuenow', String(percent));
        progressFill.style.width = `${percent}%`;
        progressLabel.textContent = `Uploading privately · ${percent}%`;
      });
      showToast(payload.message || 'Resume uploaded privately.', 'success');
      await ctx.refreshSession();
      await resumeView(ctx);
    } catch (uploadError) {
      error.textContent = uploadError.message;
      button.disabled = false;
      button.textContent = resume ? 'Replace resume' : 'Upload PDF';
      progressLabel.textContent = '';
    }
  });
  document.querySelector('#remove-resume')?.addEventListener('click', async () => {
    if (!await confirmAction({ title: 'Remove this resume?', message: 'The active profile record will be hidden. Physical object erasure requires an authorized storage-operator action.', confirmLabel: 'Remove resume', danger: true })) return;
    try {
      await api(`/api/student/resume/${resume.id}`, { method: 'DELETE', body: {} });
      showToast('Resume removed from your active profile.', 'success');
      await ctx.refreshSession();
      await resumeView(ctx);
    } catch (removeError) { showToast(removeError.message, 'error'); }
  });
  if (resume) { button.disabled = false; button.textContent = 'Continue to dashboard'; }
}
