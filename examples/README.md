# Examples

This directory contains runnable examples for `@dcyfr/ai-api`.

## Files

- `basic-usage/client.ts` — Basic API usage and request patterns.
- `custom-route/posts-router.ts` — Custom Express route integration for posts.
- `database/queries.ts` — Database query usage patterns.
- `middleware/custom-middleware.ts` — Middleware extension patterns.

## Prerequisites

- Install dependencies: `npm install`
- Ensure TypeScript toolchain is available in the package.

## Run examples

From package root:

- `npx tsx examples/basic-usage/client.ts`
- `npx tsx examples/custom-route/posts-router.ts`
- `npx tsx examples/database/queries.ts`
- `npx tsx examples/middleware/custom-middleware.ts`

## Type-check examples

- `npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --strict --esModuleInterop true --skipLibCheck true examples/custom-route/posts-router.ts examples/middleware/custom-middleware.ts`
