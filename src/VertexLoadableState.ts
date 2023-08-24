import { VertexErrorState, VertexLoadedState, VertexState } from './VertexState'
import { VertexType } from './VertexType'
import { VertexLoadableFields } from './VertexLoadableFields'
import { VertexStatus } from './VertexStatus'

// TODO prevent key clashes between loadable & (updatable & readonly) both compile and run time
export type VertexLoadableState<
   Type extends VertexType,
   Status extends VertexStatus = VertexStatus
> = {
   status: Status
   errors: Status extends 'error' ? Error[] : []
   state: VertexState<Type>
   reduxState: Type['reduxState']
   readonlyFields: Status extends 'error'
      ? {
           [K in keyof Type['readonlyFields']]: Type['readonlyFields'] | Error
        }
      : Type['readonlyFields']
   loadableFields: VertexLoadableFields<Type['loadableFields'], Status>
}
