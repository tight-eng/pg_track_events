const path = require("path");

module.exports = {
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!@ngrx|(?!deck.gl)|markdown-table)",
  ],
  maxWorkers: 1,
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      { configFile: path.resolve(__dirname, "babel.config.testing.js") },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/src/**/*.test.ts"],
};
