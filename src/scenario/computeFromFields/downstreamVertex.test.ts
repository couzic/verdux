import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('downstreamVertex.computeFromFields()', () => {
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
   const downstreamVertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice: downstreamSlice,
         upstreamFields: ['username']
      })
      .computeFromFields(['username'], {
         lowercaseUsername: ({ username }) => username.toLowerCase()
      })
   beforeEach(() => {
      graph = createGraph({
         vertices: [rootVertexConfig, downstreamVertexConfig]
      })
   })
   it('computes value from upstream field', () => {
      const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
      expect(downsteamVertex.currentState.username).to.equal('')
      expect(downsteamVertex.currentState.lowercaseUsername).to.equal('')
   })
   describe('when upstream field value changes', () => {
      beforeEach(() => {
         graph.dispatch(rootSlice.actions.setUsername('NeW nAmE'))
      })
      it('receives updated value', () => {
         const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
         expect(downsteamVertex.currentState.username).to.equal('NeW nAmE')
         expect(downsteamVertex.currentState.lowercaseUsername).to.equal(
            'new name'
         )
      })
   })
})
