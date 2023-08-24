import { VertexLoadableFields } from './VertexLoadableFields'
import { VertexStatus } from './VertexStatus'
import { VertexType } from './VertexType'

// TODO prevent key clashes between loadable & (updatable & readonly) both compile and run time
export interface VertexInternalState<
   Type extends VertexType,
   Status extends VertexStatus = VertexStatus
> {
   reduxState: {
      vertex: Type['reduxState']
      downstream: Record<string, any>
   }
   readonlyFields: Type['readonlyFields']
   loadableFields: VertexLoadableFields<Type['loadableFields'], Status>
}
