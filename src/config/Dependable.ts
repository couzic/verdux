export type Dependable<Dependencies extends {}, T> =
   | T
   | ((dependencies: Dependencies) => T)
