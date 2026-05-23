export type PullRequest = {
  url: string;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isResolvedAllReviewComments: boolean;
  nextActionDate: Date | null;
};
