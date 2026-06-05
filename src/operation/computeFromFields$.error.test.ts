import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map } from 'rxjs'
import * as sinon from 'sinon'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// computeFromFields$ is a FIELD-PRODUCING operation. When the user's inner
// stream errors it must degrade ONLY the affected field to `error` status, keep
// the graph alive (later dispatches still flow), NOT log, and recompute the
// field back to `loaded` on a later valid input. Full-graph public-API coverage.
describe('computeFromFields$ error handling', () => {
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
      const config = configureRootVertex({ slice }).computeFromFields$(['n'], {
         doubled: (fields$: any) =>
            fields$.pipe(
               map(({ n }: any) => {
                  if (n === 99) throw new Error('compute$ exploded')
                  return n * 2
               })
            )
      })
      const graph = createGraph({ vertices: [config] })
      return { graph, slice, vertex: graph.getVertexInstance(config) }
   }

   it('keeps the graph alive: a later, unrelated dispatch is still reflected', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99)) // inner stream errors
      graph.dispatch(slice.actions.setOther('alive')) // later, unrelated dispatch
      expect((vertex.currentState as any).other).to.equal('alive')
   })

   it('degrades only the affected field to error status', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99))
      const doubled = vertex.currentLoadableState.fields.doubled as any
      expect(doubled.status).to.equal('error')
   })

   it('does not log (the error-status field is the report)', () => {
      const { graph, slice } = makeGraph()
      graph.dispatch(slice.actions.setN(99))
      expect(errorStub.called).to.equal(false)
   })

   it('recomputes the field back to loaded for a later valid input', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.setN(99)) // errors → doubled is error
      graph.dispatch(slice.actions.setN(5)) // valid → doubled recomputes
      const doubled = vertex.currentLoadableState.fields.doubled as any
      expect(doubled.status).to.equal('loaded')
      expect(doubled.value).to.equal(10)
   })
})

// A computeFromFields$ computer is contracted to RETURN an Observable. A computer
// that throws when called, or returns a non-Observable, breached that contract — a
// programming error — so it fails fast (throws eagerly at createGraph), not
// degraded to an error field.
describe('computeFromFields$ return-contract breach fails fast', () => {
   const makeConfig = (computer: any) =>
      configureRootVertex({
         slice: createSlice({ name: 'root', initialState: { n: 0 }, reducers: {} })
      }).computeFromFields$(['n'], { doubled: computer })

   it('throws at construction when the computer returns a non-observable', () => {
      const config = makeConfig(() => 'not an observable')
      expect(() => createGraph({ vertices: [config] })).to.throw(
         /must return an observable/
      )
   })

   it('fails fast when the computer itself throws when called', () => {
      const config = makeConfig(() => {
         throw new Error('computer-call-boom')
      })
      expect(() => createGraph({ vertices: [config] })).to.throw(
         'computer-call-boom'
      )
   })
})
