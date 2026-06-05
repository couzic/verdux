import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { configureVertex } from '../config/configureVertex'
import { createGraph } from '../graph/createGraph'

// Diamond / multi-upstream: c pulls from both a and b, whose closest common
// ancestor is the root (neither is c's direct redux parent). So c's execution
// path is root → c, and a run must walk that while still satisfying the cross
// edges from a and b. Every `addUpstreamVertex` test elsewhere asserts only
// dependency narrowing; this is the runtime-field coverage for that path.
describe('diamond DAG: multi-upstream runtime field flow', () => {
   it('computes from both upstreams and recomputes on an upstream redux change', () => {
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root.configureDownstreamVertex({
         slice: createSlice({ name: 'a', initialState: { av: 1 }, reducers: {} })
      })
      const bSlice = createSlice({
         name: 'b',
         initialState: { bv: 10 },
         reducers: {
            setB: (s, x: PayloadAction<number>) => {
               s.bv = x.payload
            }
         }
      })
      const b = root.configureDownstreamVertex({ slice: bSlice })
      const c = configureVertex(
         {
            slice: createSlice({
               name: 'c',
               initialState: { own: 100 },
               reducers: {}
            })
         },
         _ =>
            _.addUpstreamVertex(a, { fields: ['av'] }).addUpstreamVertex(b, {
               fields: ['bv']
            })
      ).computeFromFields(['av', 'bv', 'own'], {
         sum: ({ av, bv, own }) => av + bv + own
      })

      const graph = createGraph({ vertices: [root, a, b, c] })
      const cv = graph.getVertexInstance(c)

      expect((cv.currentState as any).sum).to.equal(111)

      graph.dispatch(bSlice.actions.setB(20))
      expect((cv.currentState as any).sum).to.equal(121)
   })

   it('an a-side loadable emission recomputes c against the live root without reverting c.own or b', () => {
      const tick$ = new Subject<number>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })
      const a = root
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'a',
               initialState: { av: 1 },
               reducers: {}
            })
         })
         .load({ tick: tick$ })
      const bSlice = createSlice({
         name: 'b',
         initialState: { bv: 10 },
         reducers: {
            setB: (s, x: PayloadAction<number>) => {
               s.bv = x.payload
            }
         }
      })
      const b = root.configureDownstreamVertex({ slice: bSlice })
      const c = configureVertex(
         {
            slice: createSlice({
               name: 'c',
               initialState: { own: 100 },
               reducers: {}
            })
         },
         _ =>
            _.addUpstreamVertex(a, { fields: ['av', 'tick'] }).addUpstreamVertex(
               b,
               { fields: ['bv'] }
            )
      )
         .computeFromFields(['av', 'bv', 'own'], {
            sum: ({ av, bv, own }) => av + bv + own
         })
         .computeFromFields(['tick', 'bv', 'own'], {
            withTick: ({ tick, bv, own }) => tick + bv + own
         })

      const graph = createGraph({ vertices: [root, a, b, c] })
      const cv = graph.getVertexInstance(c)

      // Mutate b, then drive an a-side loadable emission: it triggers a partial
      // run flowing root → c carrying the live redux root. c must re-derive its
      // own slice (own = 100) and read b's live value (bv = 20), not snap back
      // to the initial bv = 10.
      graph.dispatch(bSlice.actions.setB(20))
      expect((cv.currentState as any).sum).to.equal(121)

      tick$.next(5)

      const fields = cv.currentLoadableState.fields as any
      expect(fields.withTick.status).to.equal('loaded')
      expect(fields.withTick.value).to.equal(125) // tick(5) + live bv(20) + own(100)
      expect((cv.currentState as any).sum).to.equal(121) // unchanged, not reverted
   })
})
