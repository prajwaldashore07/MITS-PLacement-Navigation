import { HttpError } from '../middleware/errors.js';

export function scoreObjectiveTest({ questions, submittedAnswers }) {
  if (!Array.isArray(submittedAnswers)) throw new HttpError(400, 'VALIDATION_ERROR', 'Answers must be a list.');
  const byQuestion = new Map();
  for (const answer of submittedAnswers) {
    const questionId = Number(answer?.questionId);
    const optionId = answer?.optionId == null || answer?.optionId === '' ? null : Number(answer.optionId);
    if (!Number.isSafeInteger(questionId) || (optionId !== null && !Number.isSafeInteger(optionId))) throw new HttpError(400, 'INVALID_ANSWER', 'One or more submitted answer IDs are invalid.');
    if (byQuestion.has(questionId)) throw new HttpError(400, 'INVALID_ANSWER', 'Each question can only have one submitted answer.');
    byQuestion.set(questionId, optionId);
  }
  const questionIds = new Set(questions.map((question) => Number(question.id)));
  for (const questionId of byQuestion.keys()) {
    if (!questionIds.has(questionId)) throw new HttpError(400, 'INVALID_ANSWER', 'An answer references a question outside this test.');
  }
  const results = questions.map((question) => {
    const selected = byQuestion.get(Number(question.id)) ?? null;
    const options = question.options || [];
    if (selected !== null && !options.some((option) => Number(option.id) === selected)) throw new HttpError(400, 'INVALID_ANSWER', 'An answer option does not belong to its question.');
    const correctOption = options.find((option) => Boolean(option.is_correct));
    const isCorrect = selected !== null && Number(correctOption?.id) === selected;
    return { questionId: Number(question.id), selectedOptionId: selected, correctOptionId: correctOption ? Number(correctOption.id) : null, isCorrect, topic: question.topic, explanation: question.explanation };
  });
  const correctCount = results.filter((answer) => answer.isCorrect).length;
  const total = questions.length;
  return { correctCount, total, percentage: total ? Math.round((correctCount / total) * 10000) / 100 : 0, answers: results };
}
