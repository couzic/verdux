import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})
const rootVertexConfig = configureRootVertex({ slice: rootSlice })

const downstreamSlice = createSlice({
   name: 'ds',
   initialState: { username: '', count: 0 },
   reducers: {
      setUsername: (state, action: PayloadAction<string>) => {
         state.username = action.payload
      },
      increment: state => {
         state.count++
      }
   }
})
const { setUsername, increment } = downstreamSlice.actions

const downstreamVertexConfig = rootVertexConfig
   .configureDownstreamVertex({
      slice: downstreamSlice
   })
   .reaction(
      setUsername,
      map(() => increment())
   )

describe('downstreamVertex.reaction()', () => {
   let graph: Graph
   let downstreamVertex: Vertex<typeof downstreamVertexConfig>

   beforeEach(() => {
      graph = createGraph({
         vertices: [rootVertexConfig, downstreamVertexConfig]
      })
      downstreamVertex = graph.getVertexInstance(downstreamVertexConfig)
   })
   describe('when action dispatched', () => {
      beforeEach(() => {
         graph.dispatch(setUsername('Bob'))
      })
      it('triggers reaction', () => {
         expect(downstreamVertex.currentState).to.deep.equal({
            username: 'Bob',
            count: 1
         })
      })
   })
})
