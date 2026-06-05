import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfig } from '../config/VertexConfig'
import { configureRootVertex } from '../config/configureRootVertex'
import { configureVertex } from '../config/configureVertex'
import { computeGraphCoreInfo } from '../graph/computeGraphCoreInfo'
import { createGraph } from '../graph/createGraph'
import { SerializedGraphStructure } from './SerializedGraphStructure'
import { VerduxDevTools } from './VerduxDevTools'
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
      const core = computeGraphCoreInfo([vertexConfig])
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
      const core = computeGraphCoreInfo([
         rootVertexConfig,
         downstreamVertexConfig
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
      const core = computeGraphCoreInfo([
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
      const core = computeGraphCoreInfo([
         rootVertexConfig,
         downstreamVertexConfig
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

   it('gives a multi-upstream edge an empty (not undefined) fields list', () => {
      // Diamond: c pulls from a and b, whose closest common ancestor is the
      // root — so the execution tree puts the edge at root → c, but c's tracked
      // fields are keyed by a and b. The root → c edge must still honour the
      // non-optional `fields: string[]` shape rather than leaking `undefined`.
      let captured: SerializedGraphStructure | undefined
      const devtools: VerduxDevTools = {
         sendGraphStructure: s => {
            captured = s
         },
         sendGraphRunOutput: () => {},
         provideForceGraphRunOutput: () => {},
         provideSerializeGraphRunData: () => {}
      }
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root.configureDownstreamVertex({
         slice: createSlice({ name: 'a', initialState: { av: 1 }, reducers: {} })
      })
      const b = root.configureDownstreamVertex({
         slice: createSlice({ name: 'b', initialState: { bv: 2 }, reducers: {} })
      })
      const c = configureVertex(
         { slice: createSlice({ name: 'c', initialState: {}, reducers: {} }) },
         _ =>
            _.addUpstreamVertex(a, { fields: ['av'] }).addUpstreamVertex(b, {
               fields: ['bv']
            })
      )
      createGraph({ vertices: [root, a, b, c], devtools })
      const rootToC = captured!.edges.find(
         e => e.downstream === c.id && e.upstream === root.id
      )
      expect(rootToC!.fields).to.deep.equal([])
   })
})
