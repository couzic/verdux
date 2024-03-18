export type DependencyProviders<Dependencies extends Record<string, any>> =
   Record<string, (dependencies: Dependencies) => any>
