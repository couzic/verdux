import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

const slice = createSlice({
   name: 'root',
   initialState: { username: '', count: 0 },
   reducers: {
      setUsername: (state, action: PayloadAction<string>) => {
         state.username = action.payload
      },
      increment: (state, action: PayloadAction<number>) => {
         state.count += action.payload
      },
      decrement: state => {
         state.count--
      }
   }
})
const { setUsername, increment, decrement } = slice.actions

describe('rootVertex.reaction()', () => {
   let graph: Graph

   describe('with simple reaction', () => {
      const rootVertexConfig = configureRootVertex({ slice }).reaction(
         setUsername,
         map(() => increment(1))
      )
      let rootVertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      describe('when action dispatched', () => {
         beforeEach(() => {
            graph.dispatch(setUsername('Bob'))
         })
         it('triggers reaction', () => {
            expect(rootVertex.currentState).to.deep.equal({
               username: 'Bob',
               count: 1
            })
         })
      })
   })

   describe('with reaction using vertex instance', () => {
      const rootVertexConfig = configureRootVertex({
         slice,
         dependencies: {
            incrementStep: () => 2
         }
      }).reaction(setUsername, (payload$, vertex) =>
         payload$.pipe(map(() => increment(vertex.dependencies.incrementStep)))
      )
      let rootVertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      describe('when action dispatched', () => {
         beforeEach(() => {
            graph.dispatch(setUsername('Bob'))
         })
         it('triggers reaction', () => {
            expect(rootVertex.currentState).to.deep.equal({
               username: 'Bob',
               count: 2
            })
         })
      })
   })

   describe('with reaction on action without payload', () => {
      const rootVertexConfig = configureRootVertex({
         slice
      }).reaction(
         decrement,
         map(() => setUsername('DECREMENTED'))
      )
      let rootVertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         graph = createGraph({
            vertices: [rootVertexConfig]
         })
         rootVertex = graph.getVertexInstance(rootVertexConfig)
      })
      describe('when action dispatched', () => {
         beforeEach(() => {
            graph.dispatch(decrement())
         })
         it('triggers reaction', () => {
            expect(rootVertex.currentState).to.deep.equal({
               username: 'DECREMENTED',
               count: -1
            })
         })
      })
   })
})
