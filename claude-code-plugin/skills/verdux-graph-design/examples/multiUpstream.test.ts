import { expect } from 'chai'
import { createSlice } from '@reduxjs/toolkit'
import { configureRootVertex, configureVertex, createGraph } from 'verdux'
import {
   dashboardVertexConfig,
   multiUpstreamVertices
} from './multiUpstreamVertexConfig'

// Phase 1b verification: how dependencies resolve for a vertex with multiple
// upstreams. Traced in src/config/VertexConfigBuilderImpl.ts (buildDependencies)
// and confirmed here end-to-end through a real graph.

const emptySlice = (name: string) =>
   createSlice({ name, initialState: {}, reducers: {} })

describe('multi-upstream dependency resolution', () => {
   it('runs the worked dashboard example (kpiService pulled from `user`)', () => {
      const graph = createGraph({ vertices: multiUpstreamVertices })
      const dashboard = graph.getVertexInstance(dashboardVertexConfig)
      // kpiService.fetch(userId, dateRange) -> of(42), so kpi loads to 42.
      expect(dashboard.currentLoadableState.status).to.equal('loaded')
      expect(dashboard.currentState.kpi).to.equal(42)
      expect(dashboard.currentState.label).to.equal('u1 / 7d')
   })

   it('does NOT auto-flow a root dependency to a multi-parent vertex when the upstream is pulled with an explicit `dependencies` list omitting it', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI', other: () => 'OTHER' }
      })
      const a = root.configureDownstreamVertex({ slice: emptySlice('a') })
      const b = root.configureDownstreamVertex({ slice: emptySlice('b') })
      // Pull only `other` from a; do not list kpiService anywhere.
      const downstream = configureVertex({ slice: emptySlice('down') }, builder =>
         builder
            .addUpstreamVertex(a, { dependencies: ['other'] })
            .addUpstreamVertex(b, { dependencies: [] })
      )
      const graph = createGraph({ vertices: [a, b, downstream] })
      const instance = graph.getVertexInstance(downstream)
      expect(instance.dependencies.other).to.equal('OTHER')
      // kpiService was never pulled -> undefined at runtime. (The static type
      // currently still reports it as present; that type-level discrepancy is
      // tracked as a source bug in ../../../../ISSUES.md #1 — the skills teach
      // the correct runtime contract: pull what you use.)
      expect((instance.dependencies as any).kpiService).to.equal(undefined)
   })

   it('DOES inherit every dependency of an upstream when the `dependencies` option is omitted', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI', other: () => 'OTHER' }
      })
      const a = root.configureDownstreamVertex({ slice: emptySlice('a') })
      const b = root.configureDownstreamVertex({ slice: emptySlice('b') })
      // No `dependencies` key on `a` -> all of a's resolved deps flow through.
      const downstream = configureVertex({ slice: emptySlice('down') }, builder =>
         builder
            .addUpstreamVertex(a, {})
            .addUpstreamVertex(b, { dependencies: [] })
      )
      const graph = createGraph({ vertices: [a, b, downstream] })
      const instance = graph.getVertexInstance(downstream)
      expect(instance.dependencies.kpiService).to.equal('KPI')
      expect(instance.dependencies.other).to.equal('OTHER')
   })

   it('confirms single-parent configureDownstreamVertex auto-flows root deps', () => {
      const root = configureRootVertex({
         slice: emptySlice('root'),
         dependencies: { kpiService: () => 'KPI' }
      })
      const child = root.configureDownstreamVertex({ slice: emptySlice('child') })
      const graph = createGraph({ vertices: [child] })
      // No explicit dependency pull, yet the root dep is present: the tree-first
      // path inherits the whole parent dependency object.
      expect(graph.getVertexInstance(child).dependencies.kpiService).to.equal(
         'KPI'
      )
   })
})
