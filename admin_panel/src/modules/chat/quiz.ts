import prisma from '../../config/db';
import { gradeAndSaveQuiz, isQuizType, QuizError, quizQuestionsOf, storedQuizAnswers } from '../../controllers/challengeController';
import { getAssetNames } from '../../utils/assetNames';
import { handler } from './http';
import { publishUpdate } from './publish';
import { ChatError } from './service';
import { requireTopic } from './topics';

/**
 * A quiz challenge («چالش تستی») under its card in chat. The thread is the quiz itself: members pick an option per
 * question and send it once; the server grades it and pays the reward. Correct answers never leave the server
 * before a member has answered, and then only that member's own right/wrong is shown to them. The correct option
 * of a question is revealed to a member only after the challenge is closed. The mentor sees everyone's result.
 */

async function requireQuizTopic(actor: Parameters<typeof requireTopic>[0], topicId: string) {
  const found = await requireTopic(actor, topicId);
  if (!isQuizType(found.topic.challenge.type)) throw new ChatError(400, 'این چالش تستی نیست');
  return found;
}

/** The members whose answers belong to this card: the recipient, the caravan, or (arena) everyone. */
async function topicStudentFilter(topic: { recipientId: string | null; spaceId: string }) {
  if (topic.recipientId) return { id: topic.recipientId };
  const space = await prisma.chatSpace.findUnique({ where: { id: topic.spaceId }, select: { caravanId: true } });
  return space?.caravanId ? { caravanId: space.caravanId } : {};
}

/** GET /chat/topics/:id/quiz: the questions without answers, and the caller's own result if they took it. */
export const getTopicQuiz = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireQuizTopic(actor, req.params.id);
  const questions = quizQuestionsOf(topic.challenge);
  const submission = await prisma.submission.findUnique({ where: { challengeId_studentId: { challengeId: topic.challengeId, studentId: actor.id } } });
  const closed = topic.status !== 'open';
  const names = await getAssetNames();
  let mine: any = null;
  if (submission) {
    const picked = storedQuizAnswers(submission, questions);
    mine = {
      submittedAt: submission.submittedAt,
      score: submission.score,
      total: questions.length,
      picked,
      results: questions.map((q, i) => picked[i] === q.correct),
      // The right option of each question, once nobody can answer any more
      correct: closed ? questions.map(q => q.correct) : null,
    };
  }
  res.json({
    status: topic.status,
    moderator,
    canAnswer: !moderator && !submission && !closed && !(topic.challenge.dueDate && topic.challenge.dueDate < new Date()) && !(topic.challenge.startDate && topic.challenge.startDate > new Date()),
    rewardAssetType: topic.challenge.rewardAssetType === 'nakh' ? 'nakh' : 'zarik',
    rewardLabel: topic.challenge.rewardAssetType === 'nakh' ? names.nakh : names.zarik,
    // Staff see the key; members only the questions
    questions: questions.map(q => (moderator ? q : { q: q.q, options: q.options })),
    mine,
  });
});

/** POST /chat/topics/:id/quiz { answers: number[] }: grades on the server, pays the reward, returns only right/wrong. */
export const submitTopicQuiz = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireQuizTopic(actor, req.params.id);
  if (moderator) throw new ChatError(403, 'راهبر و مدیر در چالش شرکت نمی‌کنند و فقط آن را مدیریت می‌کنند');
  if (topic.status !== 'open') throw new ChatError(400, 'این آزمون توسط راهبر بسته شده است');
  try {
    const { result, picked } = await gradeAndSaveQuiz(topic.challengeId, actor, req.body?.answers);
    // The card's «n نفر شرکت کرده‌اند» line follows
    await publishUpdate(topic.messageId).catch(() => undefined);
    res.json({ ...result, picked, submittedAt: new Date() });
  } catch (e: any) {
    if (e instanceof QuizError) throw new ChatError(e.status, e.message);
    throw e;
  }
});

/** GET /chat/topics/:id/quiz/results: for the mentor, every participant's answers with right/wrong and time. */
export const topicQuizResults = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireQuizTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'فقط راهبر نتیجه‌ی همه را می‌بیند');
  const questions = quizQuestionsOf(topic.challenge);
  const userWhere = await topicStudentFilter(topic);
  const submissions = await prisma.submission.findMany({
    where: { challengeId: topic.challengeId, student: userWhere },
    orderBy: { submittedAt: 'asc' },
    include: { student: { select: { id: true, name: true, avatarUrl: true, gender: true, role: true, phoneNumber: true, caravan: { select: { name: true } } } } },
  });
  const ledger = await prisma.assetTransaction.findMany({
    where: { sourceType: 'challenge_quiz', sourceId: { in: submissions.map(s => s.id) } },
    select: { sourceId: true, amount: true },
  });
  const paidOf = new Map(ledger.map(l => [l.sourceId, l.amount]));

  const rows = submissions.map(s => {
    const picked = storedQuizAnswers(s, questions);
    return {
      user: { id: s.student.id, name: s.student.name, avatarUrl: s.student.avatarUrl, gender: s.student.gender, role: s.student.role, phoneNumber: s.student.phoneNumber, caravanName: s.student.caravan?.name ?? null },
      submittedAt: s.submittedAt,
      score: s.score,
      total: questions.length,
      reward: paidOf.get(s.id) ?? 0,
      answers: questions.map((q, i) => ({ picked: picked[i], pickedText: picked[i] >= 0 ? q.options[picked[i]] ?? null : null, correct: picked[i] === q.correct })),
    };
  });

  // Who has not taken it yet (students of this card's caravan or the recipient)
  const takenIds = new Set(rows.map(r => r.user.id));
  const audience = topic.recipientId || Object.keys(userWhere).length > 0
    ? await prisma.user.findMany({ where: { ...userWhere, role: 'student' }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    : [];
  const notTaken = audience.filter(u => !takenIds.has(u.id));

  const names = await getAssetNames();
  res.json({
    status: topic.status,
    rewardLabel: topic.challenge.rewardAssetType === 'nakh' ? names.nakh : names.zarik,
    questions: questions.map((q, i) => ({ ...q, rightCount: rows.filter(r => r.answers[i].correct).length })),
    rows,
    notTaken,
  });
});
