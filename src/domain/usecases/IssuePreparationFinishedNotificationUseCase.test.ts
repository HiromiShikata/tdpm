import { IssuePreparationFinishedNotificationUseCase } from './IssuePreparationFinishedNotificationUseCase';
import { PullRequestRepository } from './adapter-interfaces/repositories/PullRequestRepository';
import { PullRequest } from '../entities/PullRequest';

const createMockRepository = (
  prs: PullRequest[],
): {
  repository: PullRequestRepository;
  setDependedIssueUrl: jest.Mock;
} => {
  const setDependedIssueUrl = jest
    .fn<Promise<void>, [string, string]>()
    .mockResolvedValue(undefined);
  const repository: PullRequestRepository = {
    findOpenByIssueUrl: jest
      .fn<Promise<PullRequest[]>, [string]>()
      .mockResolvedValue(prs),
    setDependedIssueUrl,
  };
  return { repository, setDependedIssueUrl };
};

const nonApprovedPr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  url: 'https://github.com/owner/repo/pull/1',
  isConflicted: false,
  isPassedAllCiJob: false,
  isResolvedAllReviewComments: true,
  dependedIssueUrl: null,
  ...overrides,
});

const approvedPr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  url: 'https://github.com/owner/repo/pull/2',
  isConflicted: false,
  isPassedAllCiJob: true,
  isResolvedAllReviewComments: true,
  dependedIssueUrl: null,
  ...overrides,
});

describe('IssuePreparationFinishedNotificationUseCase', () => {
  const issueUrl = 'https://github.com/owner/repo/issues/10';

  describe('non-approved PR receives depended issue URL', () => {
    test('sets depended issue URL to the issue URL when PR has no dependedIssueUrl', async () => {
      const pr = nonApprovedPr();
      const { repository, setDependedIssueUrl } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setDependedIssueUrl).toHaveBeenCalledTimes(1);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(pr.url, issueUrl);
    });

    test('includes conflicts in rejections when PR has conflicts', async () => {
      const pr = nonApprovedPr({ isConflicted: true, isPassedAllCiJob: true });
      const { repository } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(result.rejections).toContain(`${pr.url}: has conflicts`);
      expect(result.approvedPrUrl).toBeNull();
    });

    test('includes CI failure in rejections when CI is not passed', async () => {
      const pr = nonApprovedPr({ isPassedAllCiJob: false });
      const { repository } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(result.rejections).toContain(`${pr.url}: CI not passed`);
      expect(result.approvedPrUrl).toBeNull();
    });

    test('includes unresolved review comments in rejections when review comments are unresolved', async () => {
      const pr = nonApprovedPr({
        isPassedAllCiJob: true,
        isResolvedAllReviewComments: false,
      });
      const { repository } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(result.rejections).toContain(
        `${pr.url}: unresolved review comments`,
      );
      expect(result.approvedPrUrl).toBeNull();
    });
  });

  describe('approved PR still receives depended issue URL', () => {
    test('sets depended issue URL for approved PR when dependedIssueUrl is null', async () => {
      const pr = approvedPr();
      const { repository, setDependedIssueUrl } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(setDependedIssueUrl).toHaveBeenCalledTimes(1);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(pr.url, issueUrl);
      expect(result.approvedPrUrl).toBe(pr.url);
      expect(result.rejections).toHaveLength(0);
    });
  });

  describe('multiple PRs linked to the issue', () => {
    test('sets depended issue URL for every PR when all have no dependedIssueUrl', async () => {
      const pr1 = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/1',
      });
      const pr2 = approvedPr({ url: 'https://github.com/owner/repo/pull/2' });
      const pr3 = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/3',
        isConflicted: true,
      });
      const { repository, setDependedIssueUrl } = createMockRepository([
        pr1,
        pr2,
        pr3,
      ]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setDependedIssueUrl).toHaveBeenCalledTimes(3);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(pr1.url, issueUrl);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(pr2.url, issueUrl);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(pr3.url, issueUrl);
    });
  });

  describe('PR with existing depended issue URL is not overwritten', () => {
    test('does not call setDependedIssueUrl when PR already has dependedIssueUrl set', async () => {
      const pr = nonApprovedPr({
        dependedIssueUrl: 'https://github.com/owner/repo/issues/5',
      });
      const { repository, setDependedIssueUrl } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setDependedIssueUrl).not.toHaveBeenCalled();
    });

    test('sets depended issue URL only for PRs without one when mixed', async () => {
      const prWithUrl = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/1',
        dependedIssueUrl: 'https://github.com/owner/repo/issues/5',
      });
      const prWithoutUrl = approvedPr({
        url: 'https://github.com/owner/repo/pull/2',
        dependedIssueUrl: null,
      });
      const { repository, setDependedIssueUrl } = createMockRepository([
        prWithUrl,
        prWithoutUrl,
      ]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setDependedIssueUrl).toHaveBeenCalledTimes(1);
      expect(setDependedIssueUrl).toHaveBeenCalledWith(
        prWithoutUrl.url,
        issueUrl,
      );
    });
  });

  describe('no open PRs', () => {
    test('returns null approvedPrUrl and empty rejections when no open PRs', async () => {
      const { repository, setDependedIssueUrl } = createMockRepository([]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(result.approvedPrUrl).toBeNull();
      expect(result.rejections).toHaveLength(0);
      expect(setDependedIssueUrl).not.toHaveBeenCalled();
    });
  });
});
