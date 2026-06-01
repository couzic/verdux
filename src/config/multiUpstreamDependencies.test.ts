import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { createGraph } from '../graph/createGraph'
import { configureRootVertex } from './configureRootVertex'
import { configureVertex } from './configureVertex'

const emptySlice = (name: string) =>
   createSlice({ name, initialState: {}, reducers: {} })

// Regression coverage: the `addUpstreamVertex` return TYPE
// must report only the dependencies actually pulled. Runtime behaviour was
// already correct; these tests lock both the runtime contract and the type.
describe('multi-upstream dependency type narrowing', () => {
   it('narrows to the pulled subset and makes an unpulled dependency a type error', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI', other: () => 'OTHER' }
      })
      const a = root.configureDownstreamVertex({ slice: emptySlice('a') })
      const b = root.configureDownstreamVertex({ slice: emptySlice('b') })
      // Pull only `other` from a; never pull kpiService anywhere.
      const downstream = configureVertex(
         { slice: emptySlice('down') },
         builder =>
            builder
               .addUpstreamVertex(a, { dependencies: ['other'] })
               .addUpstreamVertex(b, { dependencies: [] })
      )
      const graph = createGraph({ vertices: [a, b, downstream] })
      const instance = graph.getVertexInstance(downstream)

      // `other` was pulled: it type-checks and is present at runtime.
      expect(instance.dependencies.other).to.equal('OTHER')

      // `kpiService` was NOT pulled: it must be a compile error to read it
      // (and it is undefined at runtime). The directive below FAILS the build
      // if the access ever stops being an error — i.e. if the bug regresses.
      // @ts-expect-error kpiService was not pulled into this vertex
      expect(instance.dependencies.kpiService).to.equal(undefined)
   })

   it('inherits every upstream dependency when the `dependencies` option is omitted', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI', other: () => 'OTHER' }
      })
      const a = root.configureDownstreamVertex({ slice: emptySlice('a') })
      const b = root.configureDownstreamVertex({ slice: emptySlice('b') })
      const downstream = configureVertex(
         { slice: emptySlice('down') },
         builder =>
            builder
               .addUpstreamVertex(a, {})
               .addUpstreamVertex(b, { dependencies: [] })
      )
      const graph = createGraph({ vertices: [a, b, downstream] })
      const instance = graph.getVertexInstance(downstream)
      // No directive needed: omitting `dependencies` keeps the whole upstream
      // dependency type, so both reads type-check and resolve at runtime.
      expect(instance.dependencies.kpiService).to.equal('KPI')
      expect(instance.dependencies.other).to.equal('OTHER')
   })

   it('single-parent configureDownstreamVertex still inherits the whole parent dependency object', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI' }
      })
      const child = root.configureDownstreamVertex({
         slice: emptySlice('child')
      })
      const graph = createGraph({ vertices: [child] })
      expect(graph.getVertexInstance(child).dependencies.kpiService).to.equal(
         'KPI'
      )
   })
})
