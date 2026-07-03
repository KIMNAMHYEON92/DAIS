import type { ConsensusDecision, VoteRecord } from '@app-types/modding';

const REQUIRED_VOTER_COUNT = 5;
const ACCEPT_PASS_THRESHOLD = 4;
const ACCEPT_SCORE_ADJUSTMENT = 10;
const REJECT_PASS_THRESHOLD = 1;
const REJECT_SCORE_ADJUSTMENT = -50;
const MINIMUM_CONTRIBUTOR_SCORE = 0;
const MAXIMUM_CONTRIBUTOR_SCORE = 1000;

export class ConsensusEngine {
  public evaluateConsensus(votes: VoteRecord[]): ConsensusDecision {
    if (votes.length < REQUIRED_VOTER_COUNT) {
      return {
        status: 'PENDING',
        scoreSum: 0,
        contributorScoreAdjustment: 0,
        creditsRewardAwarded: false,
      };
    }

    const scoreSum = votes.reduce((sum, vote) => sum + vote.voteValue, 0);

    if (scoreSum >= ACCEPT_PASS_THRESHOLD) {
      return {
        status: 'ACCEPT',
        scoreSum,
        contributorScoreAdjustment: ACCEPT_SCORE_ADJUSTMENT,
        creditsRewardAwarded: true,
      };
    }

    if (scoreSum <= REJECT_PASS_THRESHOLD) {
      return {
        status: 'REJECT',
        scoreSum,
        contributorScoreAdjustment: REJECT_SCORE_ADJUSTMENT,
        creditsRewardAwarded: false,
      };
    }

    return {
      status: 'PENDING',
      scoreSum,
      contributorScoreAdjustment: 0,
      creditsRewardAwarded: false,
    };
  }

  public calculateNewContributorScore(currentScore: number, adjustment: number): number {
    return Math.max(
      MINIMUM_CONTRIBUTOR_SCORE,
      Math.min(MAXIMUM_CONTRIBUTOR_SCORE, currentScore + adjustment),
    );
  }
}
