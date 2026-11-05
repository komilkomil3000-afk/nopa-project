-- Quiz challenges: the option each student picked per question, so right/wrong can be shown to the student and the mentor.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "quizAnswers" JSONB;
