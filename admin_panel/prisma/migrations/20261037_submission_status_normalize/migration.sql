-- A waiting answer was stored as either pending or PENDING_REVIEW; new writes use pending only.
UPDATE "Submission" SET "status" = 'pending' WHERE "status" = 'PENDING_REVIEW';
