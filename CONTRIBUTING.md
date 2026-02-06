# Contributing to @dcyfr/ai-api

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

1. Create a feature branch
2. Make changes with tests
3. Ensure `npm run typecheck` passes
4. Ensure `npm run test:run` passes
5. Submit PR with clear description
