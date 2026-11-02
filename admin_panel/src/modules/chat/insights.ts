import prisma from '../../config/db';

export interface InsightInput {
  title: string;
  messages: { id: string; body: string; replies: number; confused: number }[];
}

export interface InsightContent {
  summary: string;
  topics: { word: string; count: number }[];
  questions: string[];
  unanswered: string[];
  confusing: string[];
}

/** Any engine that can read a closed conversation. A model-based one can replace the rule-based one. */
export interface InsightProvider {
  name: string;
  analyze(input: InsightInput): Promise<InsightContent>;
}

const STOP_WORDS = new Set(['این', 'که', 'را', 'از', 'به', 'در', 'با', 'و', 'هم', 'یک', 'برای', 'است', 'هست', 'بود', 'ما', 'من', 'تو', 'آن', 'اون', 'رو', 'یا', 'اما', 'ولی', 'چون', 'پس', 'اگر', 'می', 'شد', 'کرد', 'باید', 'خیلی']);
const isQuestion = (t: string) => t.includes('؟') || t.includes('?');

/** Works from words and reactions alone, with no outside service. */
export const ruleBasedProvider: InsightProvider = {
  name: 'rules',
  async analyze({ messages }) {
    const counts = new Map<string, number>();
    for (const m of messages) {
      for (const w of m.body.replace(/[.,،؟?!:؛()"]+/g, ' ').split(/\s+/)) {
        if (w.length > 2 && !STOP_WORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    const topics = Array.from(counts.entries()).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));
    const questionMessages = messages.filter(m => isQuestion(m.body));
    const confusing = messages.filter(m => m.confused > 0).sort((a, b) => b.confused - a.confused).slice(0, 5).map(m => m.body.slice(0, 160));
    const unanswered = questionMessages.filter(m => m.replies === 0).slice(0, 5).map(m => m.body.slice(0, 160));
    return {
      summary: `${messages.length} پیام، ${questionMessages.length} پرسش و ${unanswered.length} پرسش بی‌پاسخ ثبت شد.`,
      topics,
      questions: questionMessages.slice(0, 5).map(m => m.body.slice(0, 160)),
      unanswered,
      confusing,
    };
  },
};

let provider: InsightProvider = ruleBasedProvider;
export function setInsightProvider(next: InsightProvider) { provider = next; }

export async function generateInsight(topicId: string): Promise<void> {
  const topic = await prisma.chatTopic.findUniqueOrThrow({ where: { id: topicId }, include: { challenge: { select: { title: true } } } });
  const rows = await prisma.chatMessage.findMany({
    where: { threadRootId: topic.messageId, deletedAt: null, kind: 'text', botKey: null },
    orderBy: { seq: 'asc' },
    include: { reactions: { select: { type: true } }, replies: { select: { id: true } } },
  });
  const content = await provider.analyze({
    title: topic.challenge.title,
    messages: rows.map(m => ({
      id: m.id, body: m.body, replies: m.replies.length,
      confused: m.reactions.filter(r => r.type === 'confused' || r.type === 'question').length,
    })),
  });
  await prisma.topicInsight.upsert({
    where: { topicId },
    update: { content: content as any, provider: provider.name },
    create: { topicId, content: content as any, provider: provider.name },
  });
}
