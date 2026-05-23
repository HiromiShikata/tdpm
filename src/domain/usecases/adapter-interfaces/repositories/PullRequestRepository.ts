import { PullRequest } from '../../../entities/PullRequest';

export interface PullRequestRepository {
  findOpenByIssueUrl(issueUrl: string): Promise<PullRequest[]>;
  setNextActionDate(prUrl: string, date: Date): Promise<void>;
}
