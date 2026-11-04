import { createChallengeScoresModel } from "./challengeScoresModel.js";

export const {
  getScoreForUser: getDailyScoreForUser,
  createScore: createDailyScore,
  getLeaderboard: getDailyLeaderboard,
  getRankForUser: getDailyRankForUser,
} = createChallengeScoresModel("daily_scores");
