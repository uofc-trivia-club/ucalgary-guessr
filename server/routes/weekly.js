import { createChallengeRouter } from "./challengeRouter.js";
import { getWeeklyPeriod } from "../utils/challengePeriods.js";
import { getOrCreateWeeklyChallenge } from "../models/weeklyModel.js";
import { createWeeklyScore, getWeeklyLeaderboard, getWeeklyRankForUser, getWeeklyScoreForUser } from "../models/weeklyScoresModel.js";

export default createChallengeRouter({
  mode: "weekly", getPeriod: getWeeklyPeriod, getChallenge: getOrCreateWeeklyChallenge,
  createScore: createWeeklyScore, getLeaderboard: getWeeklyLeaderboard,
  getRankForUser: getWeeklyRankForUser, getScoreForUser: getWeeklyScoreForUser,
});
