import {
   PayloadAction,
   createAction,
   createReducer,
   createSlice
} from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('downstreamVertex reducers', () => {
   let graph: Graph
   const rootSlice = createSlice({
      name: 'root',
      initialState: { username: '' },
      reducers: {}
   })
   const rootVertexConfig = configureRootVertex({
      slice: rootSlice
   })

   describe('from slice', () => {
      const downstreamSlice = createSlice({
         name: 'ds',
         initialState: { friend: '' },
         reducers: {
            setFriend: (state, action: PayloadAction<string>) => {
               state.friend = action.payload
            }
         }
      })
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: downstreamSlice
         }
      )
      it('creates graph without specifying root vertex config', () => {
         const graph = createGraph({ vertices: [downstreamVertexConfig] })
         expect(
            graph.getVertexInstance(rootVertexConfig).currentState.username
         ).to.equal('')
      })
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig, downstreamVertexConfig]
         })
      })
      it('creates downstream vertex', () => {
         const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
         expect(downsteamVertex.currentState.friend).to.equal('')
      })
      it('updates downstream vertex', () => {
         const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
         downsteamVertex.dispatch(
            downstreamSlice.actions.setFriend('new friend')
         )
         expect(downsteamVertex.currentState.friend).to.equal('new friend')
      })
   })

   describe('from reducer', () => {
      const setFriend = createAction<string>('setFriend')
      const downstreamReducer = createReducer({ friend: '' }, builder =>
         builder.addCase(setFriend, (state, action) => {
            state.friend = action.payload
         })
      )
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            name: 'ds',
            reducer: downstreamReducer
         }
      )
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig, downstreamVertexConfig]
         })
      })
      it('creates downstream vertex', () => {
         const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
         expect(downsteamVertex.currentState.friend).to.equal('')
      })
      it('updates downstream vertex', () => {
         const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
         downsteamVertex.dispatch(setFriend('new friend'))
         expect(downsteamVertex.currentState.friend).to.equal('new friend')
      })
   })
})
