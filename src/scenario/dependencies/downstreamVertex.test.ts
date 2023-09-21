import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureRootVertex } from '../../configureRootVertex'
import { createGraph } from '../../createGraph'

describe('downstreamVertex dependencies', () => {
   const rootVertexConfig = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      }),
      dependencies: {
         getA: () => () => of('a')
      }
   }).load(({ getA }) => ({
      a: getA()
   }))
   const downstreamVertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice: createSlice({
            name: 'ds',
            initialState: {},
            reducers: {}
         }),
         dependencies: {
            getB: () => () => of('b'),
            getAgain:
               ({ getA }) =>
               () =>
                  getA()
         }
      })
      .load(({ getB, getAgain }) => ({
         b: getB(),
         again: getAgain()
      }))
   let graph: Graph
   let rootVertex: Vertex<typeof rootVertexConfig>
   let downsteamVertex: Vertex<typeof downstreamVertexConfig>
   beforeEach(() => {
      graph = createGraph({
         vertices: [rootVertexConfig, downstreamVertexConfig]
      })
      rootVertex = graph.getVertexInstance(rootVertexConfig)
      downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
   })
   it('loads from dependencies', () => {
      expect(rootVertex.currentState.a).to.equal('a')
      expect(downsteamVertex.currentState.b).to.equal('b')
      expect(downsteamVertex.currentState.again).to.equal('a')
   })
})
