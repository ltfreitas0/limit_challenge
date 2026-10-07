/** @type {import('prettier').Config} */
const config = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  semi: true,
  // Preserve the existing line endings so lint/format pass on Windows checkouts
  // (git's autocrlf rewrites working-copy files to CRLF).
  endOfLine: 'auto',
};

export default config;
