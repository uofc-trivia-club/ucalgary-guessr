import { createChallengeRouter } from "./challengeRouter.js";
import { getDailyPeriod } from "../utils/challengePeriods.js";
import { getOrCreateDailyChallenge } from "../models/dailyModel.js";
import { createDailyScore, getDailyLeaderboard, getDailyRankForUser, getDailyScoreForUser } from "../models/scoresModel.js";

export default createChallengeRouter({
  mode: "daily", getPeriod: getDailyPeriod, getChallenge: getOrCreateDailyChallenge,
  createScore: createDailyScore, getLeaderboard: getDailyLeaderboard,
  getRankForUser: getDailyRankForUser, getScoreForUser: getDailyScoreForUser,
});
