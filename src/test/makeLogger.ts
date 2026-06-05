// A capturing logger for the error tests: inject `logger` via
// `createGraph({ logger })` or as an operation factory's trailing `logger`
// argument, then assert on what it captured — `messages` for "nothing logged"
// checks, `logged(fragment)` for a substring match. This is the standard way to
// observe a diagnostic, replacing a global `console.error` spy.
export const makeLogger = () => {
   const messages: string[] = []
   return {
      logger: { error: (message: string) => messages.push(message) },
      messages,
      logged: (fragment: string) => messages.some(m => m.includes(fragment))
   }
}
