import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import * as sinon from 'sinon'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// computeFromFields is a FIELD-PRODUCING operation. When the user's compute
// function throws it must degrade ONLY that field to `error` status (with the
// thrown error in `errors`), leave sibling computed fields `loaded`, keep the
// graph alive (later dispatches still flow), NOT log, and recompute the field
// back to `loaded` on a later valid input. Full-graph public-API coverage.
describe('computeFromFields error handling', () => {
   let errorStub: sinon.SinonStub
   beforeEach(() => {
      errorStub = sinon.stub(console, 'error')
   })
   afterEach(() => {
      errorStub.restore()
   })

   const makeGraph = () => {
      const slice = createSlice({
         name: 'root',
         initialState: { n: 0, other: '' },
         reducers: {
            setN: (s, a: PayloadAction<number>) => {
               s.n = a.payload
            },
            setOther: (s, a: PayloadAction<string>) => {
               s.other = a.payload
            }
         }
      })
      const config = configureRootVertex({ slice }).computeFromFields(['n'], {
         doubled: ({ n }: any) => {
            if (n === 99) throw new Error('compute exploded')
            return n * 2
         },
         tripled: ({ n }: any) => n * 3
      })
      const graph = createGraph({ vertices: [config] })
      return { graph, slice, vertex: graph.getVertexInstance(config) }
   }

   it('degrades only the throwing field to error, sibling stays loaded', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99))
      const fields = vertex.currentLoadableState.fields as any
      expect(fields.doubled.status).to.equal('error')
      expect(fields.doubled.value).to.equal(undefined)
      expect(fields.doubled.errors.map((e: Error) => e.message)).to.deep.equal([
         'compute exploded'
      ])
      expect(fields.tripled.status).to.equal('loaded')
      expect(fields.tripled.value).to.equal(99 * 3)
   })

   it('keeps the graph alive: a later, unrelated dispatch is still reflected', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99)) // compute throws
      graph.dispatch(slice.actions.setOther('alive')) // later, unrelated dispatch
      expect((vertex.currentState as any).other).to.equal('alive')
   })

   it('recomputes the field back to loaded for a later valid input', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99)) // throws → doubled is error
      graph.dispatch(slice.actions.setN(5)) // valid → doubled recomputes
      const doubled = vertex.currentLoadableState.fields.doubled as any
      expect(doubled.status).to.equal('loaded')
      expect(doubled.value).to.equal(10)
   })

   it('does not log (the error-status field is the report)', () => {
      const { graph, slice } = makeGraph()
      graph.dispatch(slice.actions.setN(99))
      expect(errorStub.called).to.equal(false)
   })
})
