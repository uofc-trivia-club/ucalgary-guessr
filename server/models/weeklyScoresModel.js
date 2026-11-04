import { createChallengeScoresModel } from "./challengeScoresModel.js";

export const {
  getScoreForUser: getWeeklyScoreForUser,
  createScore: createWeeklyScore,
  getLeaderboard: getWeeklyLeaderboard,
  getRankForUser: getWeeklyRankForUser,
} = createChallengeScoresModel("weekly_scores");
