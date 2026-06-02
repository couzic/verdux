import { expect } from 'chai'
import { createSlice } from '@reduxjs/toolkit'
import { Subject } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// A loadable emission triggers a partial run that flows only downstream of the
// emitting vertex, carrying the live redux root. A vertex it reaches must
// re-derive its own slice from that live root — so an emission must never
// revert a sibling whose slice was mutated by an earlier action.
describe('async loadable emission must not revert a sibling redux slice', () => {
   const plainSlice = (name: string) =>
      createSlice({
         name,
         initialState: { items: [] as number[] },
         reducers: {
            added: state => {
               state.items.push(1)
            }
         }
      })

   it('root-level siblings: loadable owner registered before the plain sibling', () => {
      const load$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({ name: 'a', initialState: {}, reducers: {} })
         })
         .load({ value: load$ })
      const bSlice = plainSlice('b')
      const b = root.configureDownstreamVertex({ slice: bSlice })

      const graph = createGraph({ vertices: [a, b] })

      load$.next(0)
      graph.dispatch(bSlice.actions.added())
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)

      load$.next(1)
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)
   })

   it('loadable owner registered after the plain sibling: forward-only flow leaves it untouched', () => {
      const load$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const bSlice = plainSlice('b')
      const b = root.configureDownstreamVertex({ slice: bSlice })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({ name: 'a', initialState: {}, reducers: {} })
         })
         .load({ value: load$ })

      const graph = createGraph({ vertices: [b, a] })

      load$.next(0)
      graph.dispatch(bSlice.actions.added())
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)

      load$.next(1)
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)
   })

   it('deeply nested siblings: emission below an intermediate vertex', () => {
      const load$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root.configureDownstreamVertex({
         slice: createSlice({ name: 'a', initialState: {}, reducers: {} })
      })
      const b = a.configureDownstreamVertex({
         slice: createSlice({ name: 'b', initialState: {}, reducers: {} })
      })
      const c = b
         .configureDownstreamVertex({
            slice: createSlice({ name: 'c', initialState: {}, reducers: {} })
         })
         .load({ value: load$ })
      const dSlice = plainSlice('d')
      const d = b.configureDownstreamVertex({ slice: dSlice })

      const graph = createGraph({ vertices: [root, a, b, c, d] })

      load$.next(0)
      graph.dispatch(dSlice.actions.added())
      expect(graph.getVertexInstance(d).currentState.items).to.have.length(1)

      load$.next(1)
      expect(graph.getVertexInstance(d).currentState.items).to.have.length(1)
   })

   it('loadFromFields: an upstream-derived loadable re-emit must not revert a sibling', () => {
      const trigger$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'a',
               initialState: { seed: 0 },
               reducers: {}
            })
         })
         .loadFromFields(['seed'], {
            value: () => trigger$
         })
      const bSlice = plainSlice('b')
      const b = root.configureDownstreamVertex({ slice: bSlice })

      const graph = createGraph({ vertices: [root, a, b] })

      trigger$.next(0)
      graph.dispatch(bSlice.actions.added())
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)

      trigger$.next(1)
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)
   })

   it('multiple loadable siblings re-emitting must not revert a later plain sibling', () => {
      const loadA$ = new Subject<number>()
      const loadC$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({ name: 'a', initialState: {}, reducers: {} })
         })
         .load({ value: loadA$ })
      const c = root
         .configureDownstreamVertex({
            slice: createSlice({ name: 'c', initialState: {}, reducers: {} })
         })
         .load({ value: loadC$ })
      const bSlice = plainSlice('b')
      const b = root.configureDownstreamVertex({ slice: bSlice })

      const graph = createGraph({ vertices: [root, a, c, b] })

      loadA$.next(0)
      loadC$.next(0)
      graph.dispatch(bSlice.actions.added())
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)

      loadA$.next(1)
      loadC$.next(1)
      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)
   })

   it('the loadable value itself survives the re-emit', () => {
      const load$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({ name: 'a', initialState: {}, reducers: {} })
         })
         .load({ value: load$ })
      const bSlice = plainSlice('b')
      const b = root.configureDownstreamVertex({ slice: bSlice })

      const graph = createGraph({ vertices: [root, a, b] })

      load$.next(0)
      graph.dispatch(bSlice.actions.added())
      load$.next(42)

      expect(graph.getVertexInstance(b).currentState.items).to.have.length(1)
      expect(graph.getVertexInstance(a).currentLoadableState.status).to.equal(
         'loaded'
      )
      expect(
         (graph.getVertexInstance(a).currentLoadableState.fields as any).value
            .value
      ).to.equal(42)
   })
})
