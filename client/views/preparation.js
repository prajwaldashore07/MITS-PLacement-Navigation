import { api } from '../api.js';
import { badge, confirmAction, dateLabel, demoNotice, esc, icon, openModal, closeModal, showToast } from '../components/ui.js';

export async function preparationView(ctx) {
  const data = await api('/api/preparation/tests');
  const params = new URLSearchParams(location.search);
  const domain = params.get('domain');
  const opportunityId = params.get('opportunity');
  const recommendationQuery = opportunityId ? new URLSearchParams({opportunityId}) : domain ? new URLSearchParams({domain}) : null;
  const recommendationData = recommendationQuery ? await api(`/api/preparation/recommendations?${recommendationQuery.toString()}`) : null;
  const recommendedIds = recommendationData ? new Set(recommendationData.items.map((item) => Number(item.test_id))) : null;
  const visibleTests = recommendedIds ? data.tests.filter((item) => recommendedIds.has(Number(item.id))) : data.tests;
  const reasonByTest = new Map((recommendationData?.items || []).map((item) => [Number(item.test_id), item.recommendation_note]));
  document.querySelector('#app').innerHTML = `<div class="page-heading"><div><div class="eyebrow">Company preparation</div><h1>${recommendationData?.opportunity ? `Prepare for ${esc(recommendationData.opportunity.company_name)}.` : recommendationData?.domain ? `Practice for ${esc(recommendationData.domain.name)}.` : 'Practice with purpose.'}</h1><p>Choose a timed objective set or review a previous attempt. Scores are calculated and saved by the server.</p></div></div>${demoNotice('Mock tests use fictional questions; objective answers are scored server-side. Coding exercises, if introduced, are manually evaluated unless a safe evaluator is explicitly implemented.')}<div class="grid-2" style="margin-top:18px"><section class="stack"><div class="panel-title"><div><h2>Available practice sets</h2><p>${recommendationData?.opportunity ? `${esc(recommendationData.opportunity.title)} · focused company-specific test set` : recommendationData?.domain ? `${esc(recommendationData.domain.name)} · recommended domain practice` : 'DSA, aptitude, reasoning, technical, CS and ETE topics'}</p></div></div>${visibleTests.map((item) => `<article class="card card-pad"><div class="row-between"><div><span class="badge info">${esc(item.category)}</span><h2 class="opportunity-title" style="margin-top:8px">${esc(item.title)}</h2></div>${badge(item.difficulty)}</div><p class="small muted">${esc(item.description)}</p>${reasonByTest.has(Number(item.id)) ? `<p class="field-help">${esc(reasonByTest.get(Number(item.id)))}</p>` : ''}<div class="row-between"><span class="field-help">${item.question_count} questions · ${item.duration_minutes} minutes</span><button class="btn small-btn" data-start-test="${item.id}" ${!item.question_count ? 'disabled' : ''}>${item.attempt_in_progress ? 'Resume test' : 'Start test'} ${icon('arrow', 14)}</button></div></article>`).join('') || '<div class="empty-state"><h3>No tests are available</h3><p>Ask an administrator to add a preparation set.</p></div>'}</section><aside class="stack"><section class="card card-pad"><div class="panel-title"><div><h2>Attempt history</h2><p>Saved objective scores</p></div></div>${data.attempts.length ? data.attempts.map((item) => `<div class="row-between" style="padding:11px 0;border-bottom:1px solid var(--ink-100)"><div><strong class="small">${esc(data.tests.find((test) => Number(test.id) === Number(item.test_id))?.title || 'Practice attempt')}</strong><div class="field-help">${dateLabel(item.submitted_at || item.started_at)} · ${esc(item.status)}</div></div>${item.status !== 'in_progress' ? `<a class="btn secondary small-btn" href="/attempts/${item.id}/results" data-route="/attempts/${item.id}/results">${item.score}%</a>` : `<a class="btn secondary small-btn" href="/tests/${item.test_id}?attempt=${item.id}" data-route="/tests/${item.test_id}?attempt=${item.id}">Resume</a>`}</div>`).join('') : '<p class="small muted">No attempts yet. Your saved results appear here.</p>'}</section><section class="card card-pad"><div class="panel-title"><div><h2>Preparation areas</h2><p>Use practice sets to focus your next session</p></div></div><div class="filter-row">${['DSA and coding', 'Quantitative aptitude', 'Logical reasoning', 'Verbal ability', 'Technical MCQs', 'Core CS fundamentals', 'Domain-specific ETE', 'Technical interviews', 'HR interviews'].map((item) => `<span class="skill-chip">${esc(item)}</span>`).join('')}</div></section></aside></div>`;
  document.querySelectorAll('[data-start-test]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const attempt = await api(`/api/tests/${button.dataset.startTest}/attempts`, { method: 'POST', body: {} });
      ctx.navigate(`/tests/${button.dataset.startTest}?attempt=${attempt.attemptId}`);
    } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
  }));
}

export async function testView(ctx, testId) {
  const params = new URLSearchParams(location.search);
  let attemptId = Number(params.get('attempt')) || 0;
  if (!attemptId) {
    const created = await api(`/api/tests/${testId}/attempts`, { method: 'POST', body: {} });
    ctx.navigate(`/tests/${testId}?attempt=${created.attemptId}`, true);
    return;
  }
  const data = await api(`/api/attempts/${attemptId}`);
  if (Number(data.test.id) !== Number(testId)) throw new Error('This saved attempt belongs to a different test.');
  if (data.attemptStatus !== 'in_progress') { ctx.navigate(`/attempts/${attemptId}/results`, true); return; }
  const questions = data.questions;
  const saved = new Map((data.savedAnswers || []).map((item) => [Number(item.questionId), item.optionId === null ? null : Number(item.optionId)]));
  let current = 0;
  const expiresAt = new Date(data.expiresAt);
  let timerId = null;
  let submitted = false;
  let submitInFlight = false;

  const submitAttempt = async (confirm = true) => {
    if (submitted || submitInFlight) return;
    if (confirm) {
      const okay = await confirmAction({ title: 'Submit this test?', message: 'Your saved answers will be scored by the server. You cannot change them after submission.', confirmLabel: 'Submit test' });
      if (!okay) return;
    }
    submitInFlight = true;
    try {
      const result = await api(`/api/attempts/${attemptId}/submit`, { method: 'POST', body: {} });
      submitted = true;
      clearInterval(timerId);
      closeModal();
      ctx.navigate(`/attempts/${attemptId}/results`);
      if (result.expired) showToast('Time expired; your saved answers were scored.', 'info');
    } catch (error) {
      submitInFlight = false;
      showToast(error.message, 'error');
    }
  };

  const mount = () => {
    const q = questions[current];
    const answered = [...saved.values()].filter((value) => value !== null).length;
    const remaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    const minutes = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    document.querySelector('#app').innerHTML = `<div class="page-heading"><div><a class="small" href="/preparation" data-route="/preparation">${icon('back', 13)} Company preparation</a><div class="eyebrow" style="margin-top:12px">${esc(data.test.category)} · ${esc(data.test.difficulty)}</div><h1>${esc(data.test.title)}</h1><p>${esc(data.test.description)}</p></div><div class="card card-pad" style="min-width:130px;text-align:center"><div class="field-help">Time remaining</div><strong class="mono" id="test-timer" style="font-size:22px;color:${remaining < 60 ? 'var(--danger-700)' : 'var(--ink-900)'}">${minutes}</strong></div></div><div class="grid-2"><section class="stack"><div class="row-between small muted"><span>Question ${current + 1} of ${questions.length}</span><span>${answered} answered · ${questions.length - answered} unanswered</span></div><article class="test-question"><div class="eyebrow">${esc(q.topic)}</div><h2 style="font-size:17px;margin:0 0 17px">${esc(q.prompt)}</h2><div>${q.options.map((option) => `<label class="answer-option"><input type="radio" name="answer-${q.id}" value="${option.id}" ${saved.get(Number(q.id)) === Number(option.id) ? 'checked' : ''}><span>${esc(option.option_text)}</span></label>`).join('')}</div></article><div class="row-between"><button class="btn secondary" type="button" id="previous-question" ${current === 0 ? 'disabled' : ''}>${icon('back', 14)} Previous</button><div class="row"><button class="btn secondary" type="button" id="review-test">Review</button>${current < questions.length - 1 ? `<button class="btn" type="button" id="next-question">Next ${icon('arrow', 14)}</button>` : '<button class="btn" type="button" id="submit-test">Submit test</button>'}</div></div></section><aside class="card card-pad"><div class="panel-title"><div><h2>Question navigator</h2><p>Select a question to revisit it</p></div></div><div class="quiz-nav">${questions.map((question, index) => `<button class="quiz-dot ${saved.get(Number(question.id)) !== undefined && saved.get(Number(question.id)) !== null ? 'answered' : ''} ${index === current ? 'current' : ''}" type="button" data-question-index="${index}" aria-label="Question ${index + 1}${saved.get(Number(question.id)) !== undefined && saved.get(Number(question.id)) !== null ? ', answered' : ', unanswered'}">${index + 1}</button>`).join('')}</div><div class="stack" style="margin-top:18px"><div class="row"><span class="quiz-dot answered" style="display:grid;place-items:center">${icon('check', 12)}</span><span class="small muted">Answered</span></div><div class="row"><span class="quiz-dot" style="display:grid;place-items:center">—</span><span class="small muted">Unanswered</span></div><p class="field-help">Your answer is saved as you select it. You may return to this attempt while its timer is running.</p></div></aside></div>`;
    document.querySelectorAll('[data-question-index]').forEach((button) => button.addEventListener('click', () => { current = Number(button.dataset.questionIndex); mount(); }));
    document.querySelectorAll(`[name="answer-${q.id}"]`).forEach((input) => input.addEventListener('change', async () => {
      const optionId = Number(input.value);
      saved.set(Number(q.id), optionId);
      try { await api(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: { answers: [{ questionId: Number(q.id), optionId }] } }); mount(); }
      catch (error) { showToast(error.message, 'error'); }
    }));
    document.querySelector('#previous-question')?.addEventListener('click', () => { current = Math.max(0, current - 1); mount(); });
    document.querySelector('#next-question')?.addEventListener('click', () => { current = Math.min(questions.length - 1, current + 1); mount(); });
    document.querySelector('#review-test')?.addEventListener('click', () => {
      const modal = openModal({ title: 'Review before submitting', body: `<p class="small muted">${answered} of ${questions.length} questions answered.</p><div class="quiz-nav">${questions.map((question, index) => `<span class="quiz-dot ${saved.get(Number(question.id)) !== undefined && saved.get(Number(question.id)) !== null ? 'answered' : ''}" title="Question ${index + 1}">${index + 1}</span>`).join('')}</div><p class="field-help" style="margin-top:14px">Unanswered questions are scored as incorrect. Correct answers remain hidden until submission.</p>`, actions: '<button class="btn secondary" data-close-modal type="button">Keep reviewing</button><button class="btn" id="review-submit" type="button">Submit now</button>' });
      modal.querySelector('#review-submit').addEventListener('click', () => submitAttempt(false));
    });
    document.querySelector('#submit-test')?.addEventListener('click', () => submitAttempt(true));
  };

  const updateTimer = () => {
    const timer = document.querySelector('#test-timer');
    if (!timer || submitted) return;
    const remaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (remaining <= 0) { clearInterval(timerId); void submitAttempt(false); }
  };

  mount();
  timerId = setInterval(updateTimer, 1000);
  ctx.setCleanup(() => clearInterval(timerId));
}

export async function resultsView(ctx, attemptId) {
  const data = await api(`/api/attempts/${attemptId}/results`);
  const attempt = data.attempt;
  document.querySelector('#app').innerHTML = `<div class="page-heading"><div><div class="eyebrow">Test results · ${esc(attempt.category)}</div><h1>${esc(attempt.title)}</h1><p>Completed ${dateLabel(attempt.submitted_at)} · ${attempt.total_questions} questions</p></div><a class="btn secondary" href="/preparation" data-route="/preparation">${icon('back', 15)} Back to preparation</a></div><div class="stats-grid"><div class="card stat-card"><span class="stat-label">Score</span><span class="stat-icon">${icon('chart', 17)}</span><div class="stat-value">${Math.round(attempt.score)}%</div><div class="stat-note">${data.questions.filter((item) => item.isCorrect).length} correct out of ${data.questions.length}</div></div><div class="card stat-card"><span class="stat-label">Attempt</span><span class="stat-icon">${icon('clock', 17)}</span><div class="stat-value">${attempt.status === 'expired' ? 'Expired' : 'Submitted'}</div><div class="stat-note">Results saved to your history</div></div></div><div class="grid-2"><section class="stack"><div class="panel-title"><div><h2>Answer review</h2><p>Correct answers and explanations are now available.</p></div></div>${data.questions.map((question, index) => `<article class="test-question"><div class="row-between"><span class="eyebrow">${esc(question.topic)} · Question ${index + 1}</span>${badge(question.isCorrect ? 'Correct' : 'Review')}</div><h3>${esc(question.prompt)}</h3><div class="stack" style="gap:6px">${question.options.map((option) => `<div class="answer-option ${Number(option.id) === Number(question.correctOptionId) ? 'complete' : ''}" style="${Number(option.id) === Number(question.correctOptionId) ? 'border-color:#9bd1b6;background:#f0faf5;color:var(--success-700);' : ''}">${esc(option.option_text)}${Number(option.id) === Number(question.selectedOptionId) ? ' · your answer' : ''}${Number(option.id) === Number(question.correctOptionId) ? ' · correct' : ''}</div>`).join('')}</div><p class="small muted" style="margin:12px 0 0">${esc(question.explanation)}</p></article>`).join('')}</section><aside class="stack"><section class="card card-pad"><div class="panel-title"><div><h2>Topic performance</h2><p>Use this to plan your next practice session.</p></div></div>${data.topicPerformance.map((item) => `<div style="margin-bottom:14px"><div class="row-between small"><span>${esc(item.topic)}</span><strong>${item.percent}%</strong></div><div class="progress-track" style="margin-top:6px"><div class="progress-fill ${item.percent >= 70 ? 'good' : item.percent < 40 ? 'warn' : ''}" style="width:${item.percent}%"></div></div><div class="field-help">${item.correct} of ${item.total} correct</div></div>`).join('')}</section><div class="callout">${icon('spark', 17)}<p>${esc(data.recommendation)}</p></div></aside></div>`;
}
