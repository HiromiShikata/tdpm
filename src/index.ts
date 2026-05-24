import dotenv from 'dotenv';
dotenv.config();
export const hello = (name: string) => `hello ${name}`;
export { IssuePreparationFinishedNotificationUseCase } from './domain/usecases/IssuePreparationFinishedNotificationUseCase';
export type { IssuePreparationFinishedNotificationResult } from './domain/usecases/IssuePreparationFinishedNotificationUseCase';
export type { PullRequest } from './domain/entities/PullRequest';
export type { PullRequestRepository } from './domain/usecases/adapter-interfaces/repositories/PullRequestRepository';
