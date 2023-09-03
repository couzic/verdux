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

describe('deepDownstreamVertex reducers', () => {
   let graph: Graph
   const rootSlice = createSlice({
      name: 'root',
      initialState: { username: '' },
      reducers: {}
   })
   const rootVertexConfig = configureRootVertex({
      slice: rootSlice
   })
   const downstreamSlice = createSlice({
      name: 'ds',
      initialState: { friend: '' },
      reducers: {
         setFriend: (state, action: PayloadAction<string>) => {
            state.friend = action.payload
         }
      }
   })
   const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex({
      slice: downstreamSlice
   })

   describe('from slice', () => {
      const deepDownstreamSlice = createSlice({
         name: 'deep',
         initialState: { otherFriend: '' },
         reducers: {
            setOtherFriend: (state, action: PayloadAction<string>) => {
               state.otherFriend = action.payload
            }
         }
      })
      const deepDownstreamVertexConfig =
         downstreamVertexConfig.configureDownstreamVertex({
            slice: deepDownstreamSlice
         })
      it('creates graph without specifying upstream vertex configs', () => {
         const graph = createGraph({ vertices: [deepDownstreamVertexConfig] })
         const deepVertex = graph.getVertexInstance(deepDownstreamVertexConfig)
         expect(deepVertex.currentState.otherFriend).to.equal('')
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
      it('creates deep downstream vertex', () => {
         const deepDownsteamVertex = graph.getVertexInstance(
            deepDownstreamVertexConfig
         )
         expect(deepDownsteamVertex.currentState.otherFriend).to.equal('')
      })
      it('updates deep downstream vertex', () => {
         const deepDownsteamVertex = graph.getVertexInstance(
            deepDownstreamVertexConfig
         )
         deepDownsteamVertex.dispatch(
            deepDownstreamSlice.actions.setOtherFriend('new other friend')
         )
         expect(deepDownsteamVertex.currentState.otherFriend).to.equal(
            'new other friend'
         )
      })
   })

   describe('from reducer', () => {
      const setOtherFriend = createAction<string>('setOtherFriend')
      const deepDownstreamReducer = createReducer(
         { otherFriend: '' },
         builder =>
            builder.addCase(setOtherFriend, (state, action) => {
               state.otherFriend = action.payload
            })
      )
      const deepDownstreamVertexConfig =
         downstreamVertexConfig.configureDownstreamVertex({
            name: 'deep',
            reducer: deepDownstreamReducer
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
      it('creates downstream vertex', () => {
         const deepDownsteamVertex = graph.getVertexInstance(
            deepDownstreamVertexConfig
         )
         expect(deepDownsteamVertex.currentState.otherFriend).to.equal('')
      })
      it('updates downstream vertex', () => {
         const deepDownsteamVertex = graph.getVertexInstance(
            deepDownstreamVertexConfig
         )
         deepDownsteamVertex.dispatch(setOtherFriend('new other friend'))
         expect(deepDownsteamVertex.currentState.otherFriend).to.equal(
            'new other friend'
         )
      })
   })
})
