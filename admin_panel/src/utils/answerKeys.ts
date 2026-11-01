// Removes quiz/challenge answer keys from data that is sent to students.
// Grading is done server-side from the full records in the database, never from client payloads.

const ANSWER_KEYS = new Set([
  'correctIndex',
  'correct_index',
  'correct',
  'correctAnswer',
  'correctAnswers',
  'correctOption',
  'correctOptions',
  'isCorrect',
  'answerIndex',
  'answer',
  'solution',
]);

function stripDeep(value: any): any {
  if (Array.isArray(value)) return value.map(stripDeep);
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const key of Object.keys(value)) {
      if (ANSWER_KEYS.has(key)) continue;
      out[key] = stripDeep(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Accepts the JSON string (questionsJson / questions) or an already parsed value and returns the
 * same shape without answer keys. Unparseable strings are dropped (null) rather than passed through.
 */
export function stripAnswerKeys(raw: any): any {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(stripDeep(JSON.parse(raw)));
    } catch {
      return null;
    }
  }
  return stripDeep(raw);
}

export function isAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase() === 'admin';
}

function stripQuiz(quiz: any) {
  if (quiz && quiz.questionsJson !== undefined) quiz.questionsJson = stripAnswerKeys(quiz.questionsJson);
  return quiz;
}

/** Mutates freshly loaded Prisma station trees (stations -> categories -> sessions -> quizzes/clips). */
export function stripStationAnswerKeys(stations: any[]): any[] {
  for (const st of stations || []) {
    for (const ch of st.challenges || []) {
      if (ch && ch.questions !== undefined) ch.questions = stripAnswerKeys(ch.questions);
    }
    for (const cat of st.categories || []) {
      for (const sess of cat.sessions || []) {
        (sess.quizzes || []).forEach(stripQuiz);
        for (const clip of sess.videoClips || []) {
          (clip.quizzes || []).forEach(stripQuiz);
        }
      }
    }
  }
  return stations;
}
