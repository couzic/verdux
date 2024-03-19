import { UnknownAction } from '@reduxjs/toolkit'
import { VertexReduxState } from '../state/VertexReduxState'

export interface GraphSeed {
   reduxState: VertexReduxState
   action?: UnknownAction
}
