# Project Documentation

## 1. Introduction
This project is a Vue.js application using Tailwind CSS for styling. It is built with Vue CLI and includes support for **TypeScript**, **ESLint**, and **Prettier**. The goal is to provide a scalable and maintainable structure for development.

---

## 2. Environment Setup

### 2.1 Prerequisites
Make sure you have the following tools installed:
- **Node.js**: 22.12.0 LTS, and it's recommended to install it using homebrew.
- **npm**: For dependency management. 
- **npx**: For running npm scripts to set up git hooks (check coding style before each commit).
- **Vue CLI**: For creating and managing Vue projects.
- **Tailwind CSS**: For styling the application.
- **ESLint**: For linting JavaScript code.
- **Prettier**: For code formatting.
- **Jest**: For unit and end-to-end testing.
- **Cypress**: For end-to-end testing.
- **Git**: For version control.

### 2.2 Installation
1. Clone the repository:
   ```shell
git clone <repository-url>
cd <project-directory>
   ```
2. Install dependencies:
```shell
npm install
```
3. Start the development server:
```shell
npm run serve
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

- `babel.config.js`: Configures Babel for transpiling JavaScript.
    
- `tailwind.config.js`: Contains Tailwind CSS configuration, including content paths and theme extensions.
    
- `postcss.config.js`: Configures PostCSS plugins, such as Tailwind CSS and Autoprefixer.
    
- `vue.config.js`: Provides Vue CLI-specific configurations for the project.
    
- `.eslintrc.js`: Configures ESLint rules and plugins for code linting.
    
- `.prettierrc`: Defines Prettier rules for consistent code formatting.

---

## 4. Coding Guidelines

### 4.1 General Rules

- Write clean, self-explanatory code.
	- For vue components, it is mot mandatory to use option or component pattern to all plugins, we'll consider case by case.

- Before each commit/push, run 
```shell
npm run lint -- --fix    
```
to apply eslint settings, assuring consistent typesetting of code.

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
- Use `.spec.js` or `.test.js` for test files.

---
## 5. Tools and Plugins

### 5.1 Development Tools

- **Vue DevTools**: Debug Vue components.
    
- **ESLint**: Ensure code quality.
    
- **Prettier**: Enforce consistent code formatting.
    

### 5.2 Important Scripts

- **Start Development Server**:
```shell
npm run serve
    ```
- **Build Project**:
```shell
npm run build
```
- **Run Tests**:
```shell
npm run test
```

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

- Use `.env` files to manage sensitive information (already ignored in `.gitignore`).
    
- Example `.env.example`:
    
    ```
    VUE_APP_API_URL=http://localhost:3000
    ```
    

---