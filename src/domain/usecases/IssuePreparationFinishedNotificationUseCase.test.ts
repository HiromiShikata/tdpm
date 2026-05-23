import { IssuePreparationFinishedNotificationUseCase } from './IssuePreparationFinishedNotificationUseCase';
import { PullRequestRepository } from './adapter-interfaces/repositories/PullRequestRepository';
import { PullRequest } from '../entities/PullRequest';

const createMockRepository = (
  prs: PullRequest[],
): {
  repository: PullRequestRepository;
  setNextActionDate: jest.Mock;
} => {
  const setNextActionDate = jest
    .fn<Promise<void>, [string, Date]>()
    .mockResolvedValue(undefined);
  const repository: PullRequestRepository = {
    findOpenByIssueUrl: jest
      .fn<Promise<PullRequest[]>, [string]>()
      .mockResolvedValue(prs),
    setNextActionDate,
  };
  return { repository, setNextActionDate };
};

const nonApprovedPr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  url: 'https://github.com/owner/repo/pull/1',
  isConflicted: false,
  isPassedAllCiJob: false,
  isResolvedAllReviewComments: true,
  nextActionDate: null,
  ...overrides,
});

const approvedPr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  url: 'https://github.com/owner/repo/pull/2',
  isConflicted: false,
  isPassedAllCiJob: true,
  isResolvedAllReviewComments: true,
  nextActionDate: null,
  ...overrides,
});

describe('IssuePreparationFinishedNotificationUseCase', () => {
  const issueUrl = 'https://github.com/owner/repo/issues/10';
  const fixedNow = new Date('2026-05-23T00:00:00.000Z');
  const expectedNextActionDate = new Date('2026-06-23T00:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fail-safe Next Action Date for non-approved PR', () => {
    test('sets Next Action Date one month from now when PR has no nextActionDate', async () => {
      const pr = nonApprovedPr();
      const { repository, setNextActionDate } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setNextActionDate).toHaveBeenCalledTimes(1);
      expect(setNextActionDate).toHaveBeenCalledWith(
        pr.url,
        expectedNextActionDate,
      );
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

  describe('approved PR still receives Next Action Date', () => {
    test('sets Next Action Date for approved PR when nextActionDate is null', async () => {
      const pr = approvedPr();
      const { repository, setNextActionDate } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(setNextActionDate).toHaveBeenCalledTimes(1);
      expect(setNextActionDate).toHaveBeenCalledWith(
        pr.url,
        expectedNextActionDate,
      );
      expect(result.approvedPrUrl).toBe(pr.url);
      expect(result.rejections).toHaveLength(0);
    });
  });

  describe('multiple PRs linked to the issue', () => {
    test('sets Next Action Date for every PR when all have no nextActionDate', async () => {
      const pr1 = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/1',
      });
      const pr2 = approvedPr({ url: 'https://github.com/owner/repo/pull/2' });
      const pr3 = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/3',
        isConflicted: true,
      });
      const { repository, setNextActionDate } = createMockRepository([
        pr1,
        pr2,
        pr3,
      ]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setNextActionDate).toHaveBeenCalledTimes(3);
      expect(setNextActionDate).toHaveBeenCalledWith(
        pr1.url,
        expectedNextActionDate,
      );
      expect(setNextActionDate).toHaveBeenCalledWith(
        pr2.url,
        expectedNextActionDate,
      );
      expect(setNextActionDate).toHaveBeenCalledWith(
        pr3.url,
        expectedNextActionDate,
      );
    });
  });

  describe('PR with existing Next Action Date is not overwritten', () => {
    test('does not call setNextActionDate when PR already has nextActionDate set', async () => {
      const existingDate = new Date('2026-06-01');
      const pr = nonApprovedPr({ nextActionDate: existingDate });
      const { repository, setNextActionDate } = createMockRepository([pr]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setNextActionDate).not.toHaveBeenCalled();
    });

    test('sets Next Action Date only for PRs without one when mixed', async () => {
      const existingDate = new Date('2026-06-01');
      const prWithDate = nonApprovedPr({
        url: 'https://github.com/owner/repo/pull/1',
        nextActionDate: existingDate,
      });
      const prWithoutDate = approvedPr({
        url: 'https://github.com/owner/repo/pull/2',
        nextActionDate: null,
      });
      const { repository, setNextActionDate } = createMockRepository([
        prWithDate,
        prWithoutDate,
      ]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      await useCase.run(issueUrl);

      expect(setNextActionDate).toHaveBeenCalledTimes(1);
      expect(setNextActionDate).toHaveBeenCalledWith(
        prWithoutDate.url,
        expectedNextActionDate,
      );
    });
  });

  describe('no open PRs', () => {
    test('returns null approvedPrUrl and empty rejections when no open PRs', async () => {
      const { repository, setNextActionDate } = createMockRepository([]);
      const useCase = new IssuePreparationFinishedNotificationUseCase(
        repository,
      );

      const result = await useCase.run(issueUrl);

      expect(result.approvedPrUrl).toBeNull();
      expect(result.rejections).toHaveLength(0);
      expect(setNextActionDate).not.toHaveBeenCalled();
    });
  });
});
