import { PullRequestRepository } from './adapter-interfaces/repositories/PullRequestRepository';

export type IssuePreparationFinishedNotificationResult = {
  approvedPrUrl: string | null;
  rejections: string[];
};

export class IssuePreparationFinishedNotificationUseCase {
  constructor(private readonly pullRequestRepository: PullRequestRepository) {}

  async run(
    issueUrl: string,
  ): Promise<IssuePreparationFinishedNotificationResult> {
    const openPrs =
      await this.pullRequestRepository.findOpenByIssueUrl(issueUrl);

    const rejections: string[] = [];
    let approvedPrUrl: string | null = null;

    for (const pr of openPrs) {
      if (
        !pr.isConflicted &&
        pr.isPassedAllCiJob &&
        pr.isResolvedAllReviewComments
      ) {
        approvedPrUrl = pr.url;
      } else {
        if (pr.isConflicted) {
          rejections.push(`${pr.url}: has conflicts`);
        }
        if (!pr.isPassedAllCiJob) {
          rejections.push(`${pr.url}: CI not passed`);
        }
        if (!pr.isResolvedAllReviewComments) {
          rejections.push(`${pr.url}: unresolved review comments`);
        }
      }

      if (pr.nextActionDate === null) {
        const nextActionDate = new Date();
        nextActionDate.setMonth(nextActionDate.getMonth() + 1);
        await this.pullRequestRepository.setNextActionDate(
          pr.url,
          nextActionDate,
        );
      }
    }

    return { approvedPrUrl, rejections };
  }
}
