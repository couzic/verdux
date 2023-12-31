import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

describe('deepDownstreamVertex upstreamFields', () => {
   let graph: Graph
   const rootSlice = createSlice({
      name: 'root',
      initialState: { username: '' },
      reducers: {
         setUsername: (state, action: PayloadAction<string>) => {
            state.username = action.payload
         }
      }
   })
   const rootVertexConfig = configureRootVertex({
      slice: rootSlice
   })
   const downstreamSlice = createSlice({
      name: 'ds',
      initialState: {},
      reducers: {}
   })
   const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
      slice: downstreamSlice,
      upstreamFields: ['username']
   })
   const deepDownsteamSlice = createSlice({
      name: 'deep',
      initialState: {},
      reducers: {}
   })
   const deepDownstreamVertexConfig =
      downstreamVertexConfig.configureDownstreamVertex({
         slice: deepDownsteamSlice,
         upstreamFields: ['username']
      })
   beforeEach(() => {
      graph = createGraph({
         vertices: [
            rootVertexConfig,
            downstreamVertexConfig,
            deepDownstreamVertexConfig
         ]
      })
   })
   it('receives upstream field value', () => {
      const deepDownsteamVertex = graph.getVertexInstance(
         deepDownstreamVertexConfig
      )
      expect(deepDownsteamVertex.currentState.username).to.equal('')
   })
   describe('when upstream field value changes', () => {
      beforeEach(() => {
         graph.dispatch(rootSlice.actions.setUsername('new name'))
      })
      it('receives updated value', () => {
         const deepDownsteamVertex = graph.getVertexInstance(
            deepDownstreamVertexConfig
         )
         expect(deepDownsteamVertex.currentState.username).to.equal('new name')
      })
   })
})
