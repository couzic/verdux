import { VertexStatus } from '../VertexStatus'
import { VertexType } from '../VertexType'
import { VertexLoadableFields } from './VertexLoadableFields'
import { VertexState } from './VertexState'

// TODO prevent key clashes between loadable & (updatable & readonly) both compile and run time
export type VertexLoadableState<
   Type extends VertexType,
   Status extends VertexStatus = VertexStatus
> = {
   version: number
   status: Status
   errors: Status extends 'error' ? Error[] : []
   state: {
      [K in keyof VertexState<Type>]: VertexState<Type>[K]
   }
   reduxState: Type['reduxState']
   readonlyFields: Status extends 'error'
      ? {
           [K in keyof Type['readonlyFields']]: Type['readonlyFields'] | Error
        }
      : Type['readonlyFields']
   loadableFields: VertexLoadableFields<Type['loadableFields'], Status>
}
