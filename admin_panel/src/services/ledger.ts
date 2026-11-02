import { Prisma } from '@prisma/client';
import { getEconomyPolicy } from './economy';

export type LedgerAsset = 'zarik' | 'nakh' | 'farsh' | 'beyragh';

const BALANCE_FIELD: Record<LedgerAsset, 'zarikBalance' | 'nakh' | 'farsh' | 'beyragh'> = {
  zarik: 'zarikBalance',
  nakh: 'nakh',
  farsh: 'farsh',
  beyragh: 'beyragh',
};

export interface BalanceChange {
  userId: string;
  asset: LedgerAsset;
  amount: number;       // negative to take away
  sourceType: string;   // what caused it, e.g. 'submission_review'
  sourceId?: string;    // with sourceType, userId and asset this is unique: the same payment cannot happen twice
  reason: string;
  createdBy: string;
  zarikCategory?: string; // category of the mirrored ZarikTransaction row
}

/**
 * The only way a balance changes: moves the balance and writes the ledger row in the caller's transaction.
 * A debit never takes a balance below zero; it throws INSUFFICIENT_BALANCE instead.
 */
export async function changeBalance(tx: Prisma.TransactionClient, change: BalanceChange): Promise<void> {
  const { userId, asset, amount, sourceType, sourceId, reason, createdBy, zarikCategory } = change;
  if (amount === 0) return;
  const field = BALANCE_FIELD[asset];

  const updated = await tx.user.updateMany({
    where: amount < 0 ? { id: userId, [field]: { gte: -amount } } : { id: userId },
    data: { [field]: { increment: amount } },
  });
  if (updated.count !== 1) throw new Error('INSUFFICIENT_BALANCE');

  const { version } = await getEconomyPolicy();
  await tx.assetTransaction.create({
    data: { userId, asset, amount, sourceType, sourceId, reason, createdBy, policyVersion: version },
  });
  if (asset === 'zarik') {
    await tx.zarikTransaction.create({
      data: { userId, amount, category: zarikCategory || sourceType, reason, createdBy },
    });
  }
}

/**
 * Pays an approved answer. Keyed on the submission, so the panel, the app and the chat evaluation
 * share one payment: whichever comes second is refused by the ledger's unique index.
 */
export function creditChallengeReward(tx: Prisma.TransactionClient, p: { submissionId: string; studentId: string; asset: 'zarik' | 'nakh'; amount: number; title: string; actorId: string }) {
  return changeBalance(tx, {
    userId: p.studentId,
    asset: p.asset,
    amount: p.amount,
    sourceType: 'submission_review',
    sourceId: p.submissionId,
    reason: `پاداش تایید تکلیف: ${p.title}`,
    createdBy: p.actorId,
    zarikCategory: 'Skill Tasks',
  });
}
