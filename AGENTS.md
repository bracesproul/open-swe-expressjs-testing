<general_rules>
- Always run `yarn lint` before committing code to ensure ESLint compliance
- ESLint configuration prohibits `console.log` usage - use `// eslint-disable-next-line no-console` if absolutely necessary
- Format code with Prettier using `yarn format` before committing (2-space indentation, no tabs)
- Use `yarn format:check` to verify formatting without making changes
- Build the project with `yarn build` which runs `yarn clean && tsc` to compile TypeScript to the `dist/` directory
- When adding new API endpoints, follow the existing pattern in `src/index.ts` with proper validation and error handling
- Always validate user input using helper functions similar to `validateUserData()` before processing
- Use TypeScript interfaces for data structures and maintain type safety throughout the codebase
- Follow the existing Express.js route structure with proper HTTP status codes and JSON responses
- Run `yarn lint:fix` to automatically fix linting issues where possible
</general_rules>

<repository_structure>
- This is a TypeScript Express.js application using ES modules (`"type": "module"` in package.json)
- Source code is located in the `src/` directory with the main application entry point at `src/index.ts`
- The main application implements a REST API for user CRUD operations with in-memory storage
- Tests are organized in `src/tests/` subdirectory with separate patterns for different test types
- TypeScript configuration uses NodeNext module resolution and compiles output to `dist/` directory
- The `dist/` directory is excluded from git and contains compiled JavaScript output
- Configuration files in root: `tsconfig.json`, `jest.config.js`, `eslint.config.js`, `.prettierrc`
- GitHub workflows are separated into three files: `ci.yml` (formatting/linting), `unit-tests.yml`, and `integration-tests.yml`
- The application uses Express.js v5 with TypeScript definitions and implements a simple user management API
</repository_structure>

<dependencies_and_installation>
- This project uses Yarn 1.22.22 as the package manager (specified in `packageManager` field)
- Install dependencies with `yarn install` for local development
- For CI environments, use `yarn install --immutable` to ensure reproducible builds
- Main dependencies: `express` and `@types/express` for the web server
- Development dependencies include TypeScript tooling, Jest for testing, ESLint, and Prettier
- The project is configured as a private package and uses ES modules
- Dependencies are locked with `yarn.lock` file - do not modify this file manually
</dependencies_and_installation>

<testing_instructions>
- Testing framework: Jest with ts-jest preset configured for ES module support
- Test files use two naming patterns: `.test.ts` for unit tests and `.int.test.ts` for integration tests
- All test files are located in the `src/tests/` directory
- Import test utilities from `@jest/globals`: `import { describe, it, expect } from "@jest/globals"`
- Run unit tests only: `yarn test` (excludes integration tests)
- Run integration tests only: `yarn test:int`
- Run a single test file: `yarn test:single` with additional configuration
- Tests have a default timeout of 20 seconds (configurable in jest.config.js)
- The Jest configuration includes ESM support with `extensionsToTreatAsEsm: [".ts"]`
- Tests should focus on API endpoints, validation functions, and business logic
</testing_instructions>
