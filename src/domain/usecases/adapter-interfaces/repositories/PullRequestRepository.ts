import { PullRequest } from '../../../entities/PullRequest';

export interface PullRequestRepository {
  findOpenByIssueUrl(issueUrl: string): Promise<PullRequest[]>;
  setDependedIssueUrl(prUrl: string, issueUrl: string): Promise<void>;
}
