import { Dependable } from './Dependable'

export type IsPlainObject<T> = T extends any[]
   ? false
   : T extends (...args: any[]) => any
   ? false
   : T extends Date
   ? false
   : T extends object
   ? true
   : false

export type IsDependablePlainObject<
   Dependencies extends {},
   T
> = T extends Dependable<Dependencies, any> ? true : IsPlainObject<T>
