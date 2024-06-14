import { PayloadAction, createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfig } from '../config/VertexConfig'
import { configureRootVertex } from '../config/configureRootVertex'
import { configureVertex } from '../config/configureVertex'
import { computeGraphCoreInfo } from './computeGraphCoreInfo'

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

const sut = computeGraphCoreInfo

describe(sut.name, () => {
   it('throws error if no vertices', () => {
      expect(() => sut([])).to.throw(
         'createGraph() requires a non-empty vertices array'
      )
   })

   it('throws error if multiple root configs', () => {
      const firstConfig = configureSimpleVertex('first')
      const secondConfig = configureSimpleVertex('second')
      expect(() => sut([firstConfig, secondConfig])).to.throw(
         'all vertex configs must have the same root vertex'
      )
   })

   it('creates graph config for single vertex', () => {
      const vertexConfig = configureSimpleVertex('root')
      const coreInfo = sut([vertexConfig])
      expect(coreInfo).to.deep.equal({
         rootReducer: coreInfo.rootReducer,
         operationsByVertexId: coreInfo.operationsByVertexId,
         vertexConfigs: [vertexConfig],
         vertexIdsInSubgraph: { [vertexConfig.id]: [vertexConfig.id] },
         vertexConfigsByClosestCommonAncestorId: {},
         trackedActionsInSubgraph: { [vertexConfig.id]: [] },
         dependenciesByVertexId: { [vertexConfig.id]: {} }
      })
   })

   it('orders correctly upstream and downstream configs', () => {
      const rootVertexConfig = configureSimpleVertex('root')
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const coreInfo = sut([downstreamVertexConfig, rootVertexConfig])
      expect(coreInfo).to.deep.equal({
         rootReducer: coreInfo.rootReducer,
         operationsByVertexId: coreInfo.operationsByVertexId,
         vertexConfigs: [rootVertexConfig, downstreamVertexConfig],
         vertexIdsInSubgraph: {
            [rootVertexConfig.id]: [
               rootVertexConfig.id,
               downstreamVertexConfig.id
            ],
            [downstreamVertexConfig.id]: [downstreamVertexConfig.id]
         },
         vertexConfigsByClosestCommonAncestorId: {
            [rootVertexConfig.id]: [downstreamVertexConfig]
         },
         trackedActionsInSubgraph: {
            [rootVertexConfig.id]: [],
            [downstreamVertexConfig.id]: []
         },
         dependenciesByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {}
         }
      })
   })

   it('orders depth first', () => {
      const rootVertexConfig = configureSimpleVertex('root')
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const deepVertexConfig = configureSimpleVertex('deep', {
         upstreamVertexConfig: downstreamVertexConfig
      })
      const siblingVertexConfig = configureSimpleVertex('sibling', {
         upstreamVertexConfig: rootVertexConfig
      })
      const graphConfig = sut([
         rootVertexConfig,
         downstreamVertexConfig,
         siblingVertexConfig,
         deepVertexConfig
      ])
      expect(graphConfig.vertexConfigs).to.deep.equal([
         rootVertexConfig,
         downstreamVertexConfig,
         deepVertexConfig,
         siblingVertexConfig
      ])
   })

   it('builds dependencies', () => {
      const rootVertexConfig = configureSimpleVertex('root', {
         dependencies: { name: () => 'Bob' }
      })
      const { dependenciesByVertexId } = sut([rootVertexConfig])
      expect(dependenciesByVertexId[rootVertexConfig.id]).to.deep.equal({
         name: 'Bob'
      })
   })

   it('passes down dependencies', () => {
      const rootVertexConfig = configureSimpleVertex('root', {
         dependencies: { name: () => 'Bob' }
      })
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const { dependenciesByVertexId } = sut([
         rootVertexConfig,
         downstreamVertexConfig
      ])
      expect(dependenciesByVertexId[rootVertexConfig.id]).to.deep.equal({
         name: 'Bob'
      })
      expect(dependenciesByVertexId[downstreamVertexConfig.id]).to.deep.equal({
         name: 'Bob'
      })
   })

   it('can use upstream dependency to create downstream dependency', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSimpleSlice('root'),
         dependencies: { name: () => 'Bob' }
      })
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSimpleSlice('downstream'),
            dependencies: {
               lowercaseName: ({ name }) => name.toLowerCase()
            }
         }
      )
      const { dependenciesByVertexId } = sut([
         rootVertexConfig,
         downstreamVertexConfig
      ])
      expect(dependenciesByVertexId[downstreamVertexConfig.id]).to.deep.equal({
         name: 'Bob',
         lowercaseName: 'bob'
      })
   })

   it('selects upstream dependency', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSimpleSlice('root'),
         dependencies: { name: () => 'Bob', other: () => 'whatever' }
      })
      const downstreamVertexConfig = configureVertex(
         {
            slice: createSimpleSlice('downstream')
         },
         _ =>
            _.addUpstreamVertex(rootVertexConfig, {
               dependencies: ['name']
            })
      )
      const { dependenciesByVertexId } = sut([
         rootVertexConfig,
         downstreamVertexConfig
      ])
      expect(dependenciesByVertexId[downstreamVertexConfig.id]).to.deep.equal({
         name: 'Bob'
      })
   })

   it('merges multiple upstream dependencies', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSimpleSlice('root')
      })
      const firstVertexConfig = rootVertexConfig.configureDownstreamVertex({
         slice: createSimpleSlice('first'),
         dependencies: {
            fromFirst: () => 'fromFirst'
         }
      })
      const secondVertexConfig = rootVertexConfig.configureDownstreamVertex({
         slice: createSimpleSlice('second'),
         dependencies: {
            fromSecond: () => 'fromSecond'
         }
      })
      const downstreamVertexConfig = configureVertex(
         {
            slice: createSimpleSlice('downstream')
         },
         _ =>
            _.addUpstreamVertex(firstVertexConfig, {
               dependencies: ['fromFirst']
            }).addUpstreamVertex(secondVertexConfig, {
               dependencies: ['fromSecond']
            })
      )
      const { dependenciesByVertexId } = sut([downstreamVertexConfig])
      expect(dependenciesByVertexId[downstreamVertexConfig.id]).to.deep.equal({
         fromFirst: 'fromFirst',
         fromSecond: 'fromSecond'
      })
   })

   it('does not overwrite with unpicked dependency', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSimpleSlice('root')
      })
      const firstVertexConfig = rootVertexConfig.configureDownstreamVertex({
         slice: createSimpleSlice('first'),
         dependencies: {
            fromFirst: () => 'fromFirst'
         }
      })
      const secondVertexConfig = rootVertexConfig.configureDownstreamVertex({
         slice: createSimpleSlice('second'),
         dependencies: {
            fromFirst: () => 'SHOULD NOT OVERWRITE',
            fromSecond: () => 'fromSecond'
         }
      })
      const downstreamVertexConfig = configureVertex(
         {
            slice: createSimpleSlice('downstream')
         },
         _ =>
            _.addUpstreamVertex(firstVertexConfig, {
               dependencies: ['fromFirst']
            }).addUpstreamVertex(secondVertexConfig, {
               dependencies: ['fromSecond']
            })
      )
      const { dependenciesByVertexId } = sut([downstreamVertexConfig])
      expect(dependenciesByVertexId[downstreamVertexConfig.id]).to.deep.equal({
         fromFirst: 'fromFirst',
         fromSecond: 'fromSecond'
      })
   })

   it('injects dependencies', () => {
      const rootVertexConfig = configureSimpleVertex('root', {
         dependencies: { name: () => 'Bob' }
      })
      const injectedConfig = rootVertexConfig.injectedWith({ name: 'Steve' })
      const { dependenciesByVertexId } = sut([injectedConfig])
      expect(dependenciesByVertexId[rootVertexConfig.id]).to.deep.equal({
         name: 'Steve'
      })
   })

   describe('inherited dependency', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSimpleSlice('root'),
         dependencies: { name: () => 'Bob' }
      })
      const downstreamVertexConfig = configureVertex(
         {
            slice: createSimpleSlice('downstream')
         },
         _ =>
            _.addUpstreamVertex(rootVertexConfig, {
               dependencies: ['name']
            })
      )
      it('inherits injected dependency', () => {
         const { dependenciesByVertexId } = sut([
            rootVertexConfig.injectedWith({ name: 'Steve' }),
            downstreamVertexConfig
         ])
         expect(dependenciesByVertexId[rootVertexConfig.id]).to.deep.equal({
            name: 'Steve'
         })
         expect(
            dependenciesByVertexId[downstreamVertexConfig.id]
         ).to.deep.equal({
            name: 'Steve'
         })
      })
      it('injects inherited dependency only', () => {
         const { dependenciesByVertexId } = sut([
            rootVertexConfig,
            downstreamVertexConfig.injectedWith({ name: 'Steve' })
         ])
         expect(dependenciesByVertexId[rootVertexConfig.id]).to.deep.equal({
            name: 'Bob'
         })
         expect(
            dependenciesByVertexId[downstreamVertexConfig.id]
         ).to.deep.equal({
            name: 'Steve'
         })
      })
   })

   it('indexes tracked actions', () => {
      const trackedAction = createAction('trackedAction')
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      })
      const downstreamSlice = createSlice({
         name: 'downstreamVertexName',
         initialState: { name: '' },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            }
         }
      })
      const downstreamVertexConfig = rootVertexConfig
         .configureDownstreamVertex({
            slice: downstreamSlice as any
         })
         .reaction(trackedAction, () => downstreamSlice.actions.setName('Bob'))
      const graphConfig = sut([rootVertexConfig, downstreamVertexConfig])
      expect(graphConfig.vertexConfigs).to.deep.equal([
         rootVertexConfig,
         downstreamVertexConfig
      ])
      expect(graphConfig.vertexIdsInSubgraph).to.deep.equal({
         [rootVertexConfig.id]: [
            rootVertexConfig.id,
            downstreamVertexConfig.id
         ],
         [downstreamVertexConfig.id]: [downstreamVertexConfig.id]
      })
      expect(graphConfig.trackedActionsInSubgraph).to.deep.equal({
         [rootVertexConfig.id]: [trackedAction],
         [downstreamVertexConfig.id]: [trackedAction]
      })
      expect(graphConfig.dependenciesByVertexId).to.deep.equal({
         [rootVertexConfig.id]: {},
         [downstreamVertexConfig.id]: {}
      })
   })
})
