import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

describe('downstreamVertex inherited dependencies', () => {
   const rootVertexConfig = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      }),
      dependencies: {
         getA: () => () => of('a')
      }
   })
   const downstreamVertexConfig = rootVertexConfig
      .configureDownstreamVertex({
         slice: createSlice({
            name: 'ds',
            initialState: {},
            reducers: {}
         })
      })
      .load(({ getA }) => ({
         a: getA()
      }))
   it('loads from inherited dependency', () => {
      const graph = createGraph({
         vertices: [rootVertexConfig, downstreamVertexConfig]
      })
      const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
      expect(downsteamVertex.currentState.a).to.equal('a')
   })
   it('loads from inherited injected dependency', () => {
      const graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ getA: () => of('b') }),
            downstreamVertexConfig
         ]
      })
      const downsteamVertex = graph.getVertexInstance(downstreamVertexConfig)
      expect(downsteamVertex.currentState.a).to.equal('b')
   })
})
