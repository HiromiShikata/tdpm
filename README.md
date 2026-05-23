# tdpm

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

## API

### `IssuePreparationFinishedNotificationUseCase`

Notifies that an issue's preparation has finished by setting the `dependedIssueUrl` field on every open PR linked to the issue that does not already have one. This ensures each PR receives a reactivation trigger regardless of its current approval state.

```typescript
import {
  IssuePreparationFinishedNotificationUseCase,
  PullRequestRepository,
} from 'tdpm';

const useCase = new IssuePreparationFinishedNotificationUseCase(repository);
const result = await useCase.run('https://github.com/owner/repo/issues/42');
// result: { approvedPrUrl: string | null, rejections: string[] }
```

#### `PullRequestRepository` (interface to implement)

```typescript
interface PullRequestRepository {
  findOpenByIssueUrl(issueUrl: string): Promise<PullRequest[]>;
  setDependedIssueUrl(prUrl: string, issueUrl: string): Promise<void>;
}
```

#### `PullRequest` (domain entity)

```typescript
type PullRequest = {
  url: string;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isResolvedAllReviewComments: boolean;
  dependedIssueUrl: string | null;
};
```

## How to use this template

1. Grant write permission to gh-actions

   https://github.com/HiromiShikata/tdpm/settings/actions

1. Set secrets (optional)

   https://github.com/HiromiShikata/tdpm/settings/secrets/actions
   - [GH_TOKEN](https://github.com/settings/tokens)
   - [NPM_TOKEN](https://www.npmjs.com/settings/hiromi/tokens)

1. Remove `How to use this template` section from README.md
