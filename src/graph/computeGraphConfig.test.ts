import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfig } from '../config/VertexConfig'
import { configureRootVertex } from '../config/configureRootVertex'
import { configureVertex } from '../config/configureVertex'
import { computeGraphConfig } from './computeGraphConfig'

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

describe(computeGraphConfig.name, () => {
   it('throws error if no vertices', () => {
      expect(() => computeGraphConfig([])).to.throw(
         'createGraph() requires a non-empty vertices array'
      )
   })

   it('throws error if multiple root configs', () => {
      const firstConfig = configureSimpleVertex('first')
      const secondConfig = configureSimpleVertex('second')
      expect(() => computeGraphConfig([firstConfig, secondConfig])).to.throw(
         'all vertex configs must have the same root vertex'
      )
   })

   it('creates graph config for single vertex', () => {
      const vertexConfig = configureSimpleVertex('root')
      const graphConfig = computeGraphConfig([vertexConfig])
      expect(graphConfig.vertexIds).to.deep.equal([vertexConfig.id])
      expect(graphConfig.vertexConfigsBySingleUpstreamVertexId).to.deep.equal(
         {}
      )
      expect(graphConfig.vertexConfigById).to.deep.equal({
         [vertexConfig.id]: vertexConfig
      })
      expect(graphConfig.dependenciesByVertexId).to.deep.equal({
         [vertexConfig.id]: {}
      })
   })

   it('orders correctly upstream and downstream configs', () => {
      const rootVertexConfig = configureSimpleVertex('root')
      const downstreamVertexConfig = configureSimpleVertex('downstream', {
         upstreamVertexConfig: rootVertexConfig
      })
      const graphConfig = computeGraphConfig([
         downstreamVertexConfig,
         rootVertexConfig
      ])
      expect(graphConfig.vertexIds).to.deep.equal([
         rootVertexConfig.id,
         downstreamVertexConfig.id
      ])
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
      const graphConfig = computeGraphConfig([
         rootVertexConfig,
         downstreamVertexConfig,
         siblingVertexConfig,
         deepVertexConfig
      ])
      expect(graphConfig.vertexIds).to.deep.equal([
         rootVertexConfig.id,
         downstreamVertexConfig.id,
         deepVertexConfig.id,
         siblingVertexConfig.id
      ])
   })

   it('builds dependencies', () => {
      const rootVertexConfig = configureSimpleVertex('root', {
         dependencies: { name: () => 'Bob' }
      })
      const { dependenciesByVertexId } = computeGraphConfig([rootVertexConfig])
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
      const { dependenciesByVertexId } = computeGraphConfig([
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
      const { dependenciesByVertexId } = computeGraphConfig([
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
      const { dependenciesByVertexId } = computeGraphConfig([
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
      const { dependenciesByVertexId } = computeGraphConfig([
         downstreamVertexConfig
      ])
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
      const { dependenciesByVertexId } = computeGraphConfig([
         downstreamVertexConfig
      ])
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
      const { dependenciesByVertexId } = computeGraphConfig([injectedConfig])
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
         const { dependenciesByVertexId } = computeGraphConfig([
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
         const { dependenciesByVertexId } = computeGraphConfig([
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
})
