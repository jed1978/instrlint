# Deploy Skill

Automates the deployment process for staging and production environments.

## Usage

```
/deploy [staging|production]
```

## Steps

1. Run `pnpm build` to produce the production bundle.
2. Run `pnpm test` to verify all tests pass.
3. Push to the target branch or tag the release.
4. Monitor the pipeline for completion.
