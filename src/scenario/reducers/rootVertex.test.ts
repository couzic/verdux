import {
   PayloadAction,
   createAction,
   createReducer,
   createSlice
} from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('rootVertex reducers', () => {
   let graph: Graph

   describe('from slice', () => {
      const slice = createSlice({
         name: 'root',
         initialState: { username: '' },
         reducers: {
            setUsername: (state, action: PayloadAction<string>) => {
               state.username = action.payload
            }
         }
      })
      const rootVertexConfig = configureRootVertex({
         slice
      })
      let rootVertex: Vertex<typeof rootVertexConfig>
      let loadableStateEmissions: number
      let stateEmissions: number
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getInstance(rootVertexConfig)
         loadableStateEmissions = 0
         stateEmissions = 0
         rootVertex.loadableState$.subscribe(() => loadableStateEmissions++)
         rootVertex.state$.subscribe(() => stateEmissions++)
      })
      it('creates simplest vertex', () => {
         expect(rootVertex.currentState.username).to.equal('')
         expect(rootVertex.currentLoadableState.status).to.equal('loaded')
         expect(rootVertex.currentLoadableState.errors).to.deep.equal([])
      })
      it('emits loadableState and state exactly once each', () => {
         expect(loadableStateEmissions).to.equal(1)
         expect(stateEmissions).to.equal(1)
      })
      describe('when username is updated', () => {
         beforeEach(() => {
            rootVertex.dispatch(slice.actions.setUsername('new name'))
         })
         it('updates vertex state', () => {
            expect(rootVertex.currentState.username).to.equal('new name')
         })
         it('emits new state', () => {
            expect(loadableStateEmissions).to.equal(2)
            expect(stateEmissions).to.equal(2)
         })
      })
   })

   describe('from reducer', () => {
      const setUsername = createAction<string>('setUsername')
      const reducer = createReducer({ username: '' }, builder =>
         builder.addCase(setUsername, (state, action) => {
            state.username = action.payload
         })
      )
      const rootVertexConfig = configureRootVertex({
         name: 'root',
         reducer
      })
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
      })
      it('creates simplest vertex', () => {
         const rootVertex = graph.getInstance(rootVertexConfig)
         expect(rootVertex.currentState.username).to.equal('')
      })
      it('updates vertex state', () => {
         const rootVertex = graph.getInstance(rootVertexConfig)
         rootVertex.dispatch(setUsername('new name'))
         expect(rootVertex.currentState.username).to.equal('new name')
      })
   })
})
