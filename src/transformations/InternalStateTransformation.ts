import { Observable } from 'rxjs'
import { VertexInternalState } from '../state/VertexInternalState'

export type InternalStateTransformation = (
   dependencies: any
) => (
   internalState$: Observable<VertexInternalState<any>>
) => Observable<VertexInternalState<any>>

export type InjectedTransformation = ReturnType<InternalStateTransformation>
