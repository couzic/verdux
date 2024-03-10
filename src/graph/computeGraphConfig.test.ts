import { expect } from 'chai'
import { computeGraphConfig } from './computeGraphConfig'
import { configureRootVertex } from '../config/configureRootVertex'
import { createSlice } from '@reduxjs/toolkit'

describe(computeGraphConfig.name, () => {
   it('throws error if no vertices', () => {
      expect(() => computeGraphConfig([])).to.throw(
         'createGraph() requires a non-empty vertices array'
      )
   })

   it('throws error if multiple root configs', () => {
      const firstConfig = configureRootVertex({
         slice: createSlice({
            name: 'first',
            initialState: {},
            reducers: {}
         })
      })
      const secondConfig = configureRootVertex({
         slice: createSlice({
            name: 'second',
            initialState: {},
            reducers: {}
         })
      })
      expect(() => computeGraphConfig([firstConfig, secondConfig])).to.throw(
         'all vertex configs must have the same root vertex'
      )
   })

   it('creates graph config for single vertex', () => {
      const vertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      })
      const graphConfig = computeGraphConfig([vertexConfig])
      expect(graphConfig.vertexIds).to.deep.equal([vertexConfig.id])
      expect(graphConfig.vertexIdsBySingleUpstreamVertexId).to.deep.equal({})
      expect(graphConfig.vertexConfigById).to.deep.equal({
         [vertexConfig.id]: vertexConfig
      })
      expect(graphConfig.injectedDependenciesByVertexId).to.deep.equal({
         [vertexConfig.id]: {}
      })
   })
})
