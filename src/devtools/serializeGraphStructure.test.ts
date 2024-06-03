import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfig } from '../config/VertexConfig'
import { configureRootVertex } from '../config/configureRootVertex'
import { computeGraphCore } from '../graph/computeGraphCore'
import { serializeGraphStructure } from './serializeGraphStructure'

const createSimpleSlice = (name: string) =>
   createSlice({
      name,
      initialState: {},
      reducers: {}
   })

const configureSimpleVertex = (
   name: string,
   options: {
      upstreamVertexConfig?: VertexConfig<any>
      dependencies?: Record<string, any>
   } = {}
) => {
   const slice = createSimpleSlice(name)
   if (!options.upstreamVertexConfig) {
      return configureRootVertex({
         slice,
         dependencies: options.dependencies
      })
   }
   return options.upstreamVertexConfig.configureDownstreamVertex({
      slice,
      dependencies: options.dependencies
   })
}

const sut = serializeGraphStructure

describe(sut.name, () => {
   it('handles single vertex graph', () => {
      const vertexConfig = configureSimpleVertex('root')
      const core = computeGraphCore([vertexConfig])
      const serializedStructure = serializeGraphStructure(core)
      expect(serializedStructure).to.deep.equal({
         vertices: [
            {
               id: 'root',
               name: 'root',
               isRoot: true
            }
         ],
         edges: []
      })
   })

   it('handles graph with downstream vertex', () => {
      const rootVertexConfig = configureSimpleVertex('root')
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const core = computeGraphCore([rootVertexConfig, downstreamVertexConfig])
      const serializedStructure = serializeGraphStructure(core)
      expect(serializedStructure).to.deep.equal({
         vertices: [
            {
               id: 'root',
               name: 'root',
               isRoot: true
            },
            {
               id: 'downstream',
               name: 'downstream',
               isRoot: false
            }
         ],
         edges: [
            {
               upstream: 'root',
               downstream: 'downstream',
               fields: []
            }
         ]
      })
   })

   it('handles graph with deep downstream vertex', () => {
      const rootVertexConfig = configureSimpleVertex('root')
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const deepDownstreamVertexConfig = configureSimpleVertex(
         'deepDownstream',
         {
            upstreamVertexConfig: downstreamVertexConfig
         }
      )
      const core = computeGraphCore([
         rootVertexConfig,
         downstreamVertexConfig,
         deepDownstreamVertexConfig
      ])
      const serializedStructure = serializeGraphStructure(core)
      expect(serializedStructure).to.deep.equal({
         vertices: [
            {
               id: 'root',
               name: 'root',
               isRoot: true
            },
            {
               id: 'downstream',
               name: 'downstream',
               isRoot: false
            },
            {
               id: 'downstream.deepDownstream',
               name: 'deepDownstream',
               isRoot: false
            }
         ],
         edges: [
            {
               upstream: 'root',
               downstream: 'downstream',
               fields: []
            },
            {
               upstream: 'downstream',
               downstream: 'downstream.deepDownstream',
               fields: []
            }
         ]
      })
   })

   it('outputs fields in edges', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { name: 'Bob' },
            reducers: {}
         })
      })
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstream',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['name']
         }
      )
      const core = computeGraphCore([rootVertexConfig, downstreamVertexConfig])
      const serializedStructure = serializeGraphStructure(core)
      expect(serializedStructure).to.deep.equal({
         vertices: [
            {
               id: 'root',
               name: 'root',
               isRoot: true
            },
            {
               id: 'downstream',
               name: 'downstream',
               isRoot: false
            }
         ],
         edges: [
            {
               upstream: 'root',
               downstream: 'downstream',
               fields: ['name']
            }
         ]
      })
   })
})
