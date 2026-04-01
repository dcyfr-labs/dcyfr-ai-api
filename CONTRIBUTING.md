# Contributing to @dcyfr/ai-api

## Licensing & Contributions

By contributing to `@dcyfr/ai-api`, you agree that:

- Your contributions will be licensed under the project's MIT License
- You have the right to submit the contribution under this license
- You grant DCYFR Labs perpetual rights to use, modify, and distribute your contribution

### Trademark

Do not use "DCYFR" trademarks in ways that imply endorsement without permission. See [../TRADEMARK.md](../TRADEMARK.md) for usage guidelines.

**Questions?** Contact [licensing@dcyfr.ai](mailto:licensing@dcyfr.ai)

## Development Setup

```bash
npm install
npm run dev
```

## Code Standards

- TypeScript strict mode
- ESLint for linting (`npm run lint`)
- Prettier for formatting
- All routes must have Zod validation
- All services must have unit tests

## Testing

- Write tests for all services, middleware, and routes
- Use in-memory SQLite for test isolation
- Run `npm run test:run` before submitting changes

## Pull Requests

**Branch Naming Convention:**
```bash
# Format: <type>/DCYFR-<NUMBER>-<description>
git checkout -b feat/DCYFR-123-add-new-feature
git checkout -b fix/DCYFR-456-resolve-bug
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**PR Workflow:**
1. Create a feature branch following naming convention above
2. Make changes with tests
3. Ensure `npm run typecheck` passes
4. Ensure `npm run test:run` passes
5. Submit PR with title: `[DCYFR-<NUMBER>] Brief description`
6. Include `DCYFR-<NUMBER>` reference in commit messages
