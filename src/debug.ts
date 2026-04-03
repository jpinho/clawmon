const IS_DEBUG = process.argv.includes('--debug');

export function isDebug(): boolean {
  return IS_DEBUG;
}

export function debug(...args: unknown[]): void {
  if (IS_DEBUG) {
    console.log('\x1b[90m  [debug]\x1b[0m', ...args);
  }
}
