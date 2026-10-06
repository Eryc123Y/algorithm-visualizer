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

- `src/`: Application source code.

  - `components/`: Reusable Vue components.

  - `views/`: Page-level components.

  - `assets/`: Static assets like images and styles.

  - `router/`: Vue Router configuration.

- `public/`: Public static files.

- `tests/`: Unit and end-to-end tests.

### 3.2 Key Configurations

- `vite.config.ts`: Vite build/dev-server config (Vue and Tailwind plugins, `@` alias to `src/`).
- `vitest.config.ts`: Unit test config (extends the Vite config, runs in `happy-dom`).
- `playwright.config.ts`: E2E test config (runs against the production build).
- `tsconfig.json`: Solution file referencing `tsconfig.app.json` (app code), `tsconfig.test.json` (tests) and `tsconfig.node.json` (config files).
- `eslint.config.ts`: ESLint flat config (Vue + type-aware TypeScript rules).
- `.prettierrc.json`: Prettier rules.
- `.lintstagedrc.json`: Checks run on staged files by the Husky pre-commit hook.
- Tailwind CSS v4 needs no config file; it is loaded via `@import 'tailwindcss'` in `src/assets/css/tailwind.css`.

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
- Unit tests (Vitest) live in `tests/unit/` or next to the source as `*.spec.ts`.
- E2E tests (Playwright) live in `tests/e2e/` as `*.spec.ts`.

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
