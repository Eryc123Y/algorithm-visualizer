# Project Documentation

## 1. Introduction

This project is a Vue 3 application using Tailwind CSS for styling. It is built with **Vite** and includes support for **TypeScript**, **ESLint**, and **Prettier**. The goal is to provide a scalable and maintainable structure for development.

---

## 2. Environment Setup

### 2.1 Prerequisites

- **Node.js** >= 22.12 (see `.nvmrc`).
- **npm** (bundled with Node.js).
- **Git**.

Everything else (Vite, TypeScript, ESLint, Prettier, Vitest, Playwright, Husky) is a dev dependency installed by `npm install`.

### 2.2 Installation

```shell
git clone <repository-url>
cd algorithm-visualizer
npm install
npx playwright install chromium   # only needed for E2E tests
npm run dev
```

---

## 3. Directory Structure

### 3.1 Key Directories

This is an npm workspaces monorepo.

- `packages/spec/` (`@algoviz/spec`): protocol schemas (Zod), inferred types, parsing and validation. No DOM or Node.js APIs (ADR 0005).
  - `schema/visualization.schema.json`: generated JSON Schema; regenerate with `npm run generate:schema -w @algoviz/spec`.
- `apps/playground/` (`@algoviz/playground`): Vite + Vue demo and documentation app.
  - `src/`, `public/`, `tests/unit/`, `tests/e2e/`.
- `conformance/`: language-agnostic JSON fixtures every implementation must pass (see its README).
- `docs/adr/`: architecture decision records.

### 3.2 Key Configurations

- `tsconfig.base.json`: strict compiler options shared by all packages.
- `tsconfig.json`: solution file referencing every project; `npm run typecheck` builds them all.
- `vitest.config.ts`: runs the unit tests of every workspace as Vitest projects.
- `eslint.config.ts`: ESLint flat config (Vue + type-aware TypeScript rules) for the whole repo.
- `.prettierrc.json`: Prettier rules.
- `.lintstagedrc.json`: checks run on staged files by the Husky pre-commit hook.
- `apps/playground/vite.config.ts`, `playwright.config.ts`: app build and E2E test config.
- `packages/spec/tsconfig.lib.json`: library build (ES2022 only, no DOM or Node types); `tsconfig.test.json`: tests and scripts.
- Tailwind CSS v4 needs no config file; it is loaded via `@import 'tailwindcss'` in `apps/playground/src/assets/css/tailwind.css`.

---

## 4. Coding Guidelines

### 4.1 General Rules

- Write clean, self-explanatory code.
  - For vue components, it is mot mandatory to use option or component pattern to all plugins, we'll consider case by case.

- The pre-commit hook runs ESLint and Prettier on staged files automatically. Before pushing, run

```shell
npm run check
```

which runs type checking, linting, format checking and unit tests (the same checks CI runs).

- Use comments to explain complex logic.

- Follow the unified code format enforced by ESLint and Prettier.

### 4.2 Naming Conventions

- **File names**: Use `kebab-case` (e.g., `user-profile.vue`).

- **Vue Component names**: Use `PascalCase` (e.g., `UserProfile`).

- **Variables and functions**: Use `camelCase`.

### 4.3 Tailwind Usage

- Reuse common styles through Tailwind's utility classes.

- Use component-level `class` attributes for layout styling to maintain readability.

### 4.4 Comments and Documentation

#### For Vue Components:

- Add a brief description of the component at the top of each file.
- Document the purpose of each prop and emitted event using comments.
- Example:

```js
/**
 * UserProfile.vue
 * Component to display user profile information.
 * Props:
 * - name: The name of the user (String).
 * - age: The age of the user (Number).
 */
export default {
  props: {
    name: String,
    age: Number,
  },
};
```

#### For Backend Logic (TypeScript Files):

- Add a summary of the file's purpose at the top.
- Use JSDoc-style comments to describe functions, parameters, and return values.
- Example:

```ts
/**
 * Function to fetch user data from the API.
 * @param userId - The ID of the user to fetch.
 * @returns A Promise resolving to the user data.
 */
async function getUserData(userId: string): Promise<UserData> {
  // API call logic here
}
```

### 4.5 Testing

- Write unit tests for all components.
- Test coverage should meet the project's minimum standard (e.g., 80%).
- Unit tests (Vitest) live in each workspace's `tests/` directory as `*.spec.ts`.
- Type-level behaviour is tested with `expectTypeOf`; these assertions are enforced by `npm run typecheck`.
- Protocol behaviour that other implementations must match belongs in `conformance/` as JSON fixtures.
- E2E tests (Playwright) live in `apps/playground/tests/e2e/`.

---

## 5. Tools and Plugins

### 5.1 Development Tools

- **Vue DevTools**: Debug Vue components.

- **ESLint**: Ensure code quality.

- **Prettier**: Enforce consistent code formatting.

### 5.2 Important Scripts

| Command                                     | Purpose                             |
| ------------------------------------------- | ----------------------------------- |
| `npm run dev`                               | Start the dev server                |
| `npm run build`                             | Type-check and build for production |
| `npm run preview`                           | Serve the production build locally  |
| `npm run typecheck`                         | Run `vue-tsc`                       |
| `npm run lint` / `lint:fix`                 | Run ESLint                          |
| `npm run format` / `format:check`           | Run Prettier                        |
| `npm test` / `test:watch` / `test:coverage` | Run unit tests (Vitest)             |
| `npm run test:e2e`                          | Run E2E tests (Playwright)          |
| `npm run check`                             | All of the fast checks above        |

---

## 6. Git Workflow

### 6.1 Branching Strategy

- **Main Branch**: `main`, contains stable code.

- **Feature Branches**: Use separate branches for each feature (e.g., `feature/add-auth`).

Note that, we only merge a branch to main when the branch is proven finished and passed all tests.

### 6.2 Commit Message Format

Follow this template:

```
[Type]: Description
```

**Types**:

- `feat`: Add new features.
- `fix`: Fix bugs.
- `docs`: Update documentation.
- `test`: Add or modify tests.
- `chore`: Miscellaneous tasks.

---

## 7. Environment Variables

### 7.1 Local Environment

- Use `.env.local` files for local secrets (ignored by `.gitignore`). Only variables prefixed with `VITE_` are exposed to client code, via `import.meta.env`.

- Example `.env.example`:

  ```
  VITE_API_URL=http://localhost:3000
  ```

---
