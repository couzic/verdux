import { Reducer } from '@reduxjs/toolkit'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphInfo } from '../run/GraphInfo'

export interface GraphCore extends GraphInfo {
   /** exhaustive and sorted */
   vertexConfigs: VertexConfigImpl[]
   rootReducer: Reducer
}
