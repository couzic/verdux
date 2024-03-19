import { UnknownAction } from '@reduxjs/toolkit'
import { GraphData } from './GraphData'

export interface GraphTransformable {
   graphData: GraphData
   action?: UnknownAction
}
