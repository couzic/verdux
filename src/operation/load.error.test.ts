import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable, Subject, defer, of, tap, throwError } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'
import { VertexRunData } from '../run/RunData'
import { makeLogger } from '../test/makeLogger'
import { load } from './load'

const createInitialRunData = (fields: Record<string, any>): VertexRunData => {
   const changedFields: Record<string, true> = {}
   Object.keys(fields).forEach(fieldName => {
      changedFields[fieldName] = true
   })
   return {
      action: undefined,
      fields,
      changedFields,
      fieldsReactions: [],
      reactions: [],
      sideEffects: [],
      initialRun: true
   }
}

describe('load() loader error', () => {
   let inputData$: Subject<VertexRunData>
   let latestInputData: VertexRunData
   // The failing loader source, set per scenario. `defer` re-runs the factory
   // on each subscription so we can assert that verdux NEVER re-subscribes
   // (firstSubscriptionCount must stay 1).
   let firstSource$: Observable<any>
   let firstSubscriptionCount: number
   let secondValue$: Subject<string>
   let latestOutputData: VertexRunData | undefined
   let outputStreamErrored: boolean
   let outputStreamCompleted: boolean

   beforeEach(() => {
      latestOutputData = undefined
      outputStreamErrored = false
      outputStreamCompleted = false
      firstSubscriptionCount = 0
      inputData$ = new Subject()
      secondValue$ = new Subject()
      const firstValue$ = defer(() => {
         firstSubscriptionCount++
         return firstSource$
      })
      const outputData$ = load({
         firstValue: firstValue$,
         secondValue: secondValue$
      })(inputData$.pipe(tap(data => (latestInputData = data))))
      outputData$.subscribe({
         next: outputData => (latestOutputData = outputData),
         error: () => (outputStreamErrored = true),
         complete: () => (outputStreamCompleted = true)
      })
   })

   describe('when a loader ERRORS its stream', () => {
      const error = new Error('boom')
      beforeEach(() => {
         firstSource$ = throwError(() => error)
         inputData$.next(
            createInitialRunData({
               slice: { status: 'loaded', value: 'passthrough', errors: [] }
            })
         )
         secondValue$.next('Second value')
      })
      it('sets ONLY the failing field to status error with the error captured', () => {
         expect(latestOutputData?.fields.firstValue).to.deep.equal({
            status: 'error',
            value: undefined,
            errors: [error]
         })
      })
      it('leaves the other loadable field and the passthrough state intact', () => {
         expect(latestOutputData?.fields.secondValue).to.deep.equal({
            status: 'loaded',
            value: 'Second value',
            errors: []
         })
         expect(latestOutputData?.fields.slice).to.deep.equal({
            status: 'loaded',
            value: 'passthrough',
            errors: []
         })
      })
      it('does NOT terminate the vertex stream', () => {
         expect(outputStreamErrored).to.be.false
         expect(outputStreamCompleted).to.be.false
      })
      it('does NOT re-subscribe the source (no retry loop)', () => {
         expect(firstSubscriptionCount).to.equal(1)
      })
      it('still passes through later upstream changes after the error', () => {
         inputData$.next({
            ...latestInputData,
            initialRun: false,
            fields: {
               slice: { status: 'loaded', value: 'updated', errors: [] }
            },
            changedFields: { slice: true }
         })
         expect(latestOutputData?.fields.slice).to.deep.equal({
            status: 'loaded',
            value: 'updated',
            errors: []
         })
      })
   })
})

// Full-graph counterpart: drive the failure through the PUBLIC API only
// (createGraph + dispatch + currentLoadableState/currentState), exactly as a UI
// component would consume it. Proves the op contains its own stream error:
// degrades only its field to status:'error', keeps the sibling loaded and the
// graph alive, and never logs (a field-producing op carries the error in the
// field). `load` builds its loaders once, so the errored field stays in error.
describe('load() loader error — full graph', () => {
   const makeSlice = () =>
      createSlice({
         name: 'root',
         initialState: { other: '' },
         reducers: {
            setOther: (state, action: PayloadAction<string>) => {
               state.other = action.payload
            }
         }
      })

   let graph: ReturnType<typeof createGraph>
   let vertex: ReturnType<typeof graph.getVertexInstance>
   let setOther: (other: string) => PayloadAction<string>
   let loggedMessages: string[]

   beforeEach(() => {
      const { logger, messages } = makeLogger()
      loggedMessages = messages

      const slice = makeSlice()
      setOther = slice.actions.setOther
      const rootVertexConfig = configureRootVertex({ slice }).load({
         // Erroring source: degrades to an error field, leaving the sibling and
         // the graph alive.
         upper: throwError(() => new Error('boom')),
         // Healthy sibling in the SAME load() map.
         lower: of('healthy')
      })
      graph = createGraph({ vertices: [rootVertexConfig], logger })
      vertex = graph.getVertexInstance(rootVertexConfig)
   })

   it('degrades ONLY the failing field to error, sibling stays loaded', () => {
      const ls = vertex.currentLoadableState
      expect(ls.fields.upper.status).to.equal('error')
      expect(ls.fields.upper.value).to.equal(undefined)
      expect(ls.fields.upper.errors.map(e => e.message)).to.deep.equal(['boom'])
      expect(ls.fields.lower.status).to.equal('loaded')
      expect(ls.fields.lower.value).to.equal('healthy')
   })

   it('keeps the graph alive: a later unrelated dispatch is still processed', () => {
      graph.dispatch(setOther('alive'))
      expect(vertex.currentState.other).to.equal('alive')
      // The errored field and sibling are still readable: nothing was torn down.
      expect(vertex.currentLoadableState.fields.upper.status).to.equal('error')
      expect(vertex.currentLoadableState.fields.lower.status).to.equal('loaded')
   })

   it('keeps the field in error (load builds its loaders once) after a later dispatch', () => {
      expect(vertex.currentLoadableState.fields.upper.status).to.equal('error')
      graph.dispatch(setOther('alive'))
      const field = vertex.currentLoadableState.fields.upper
      expect(field.status).to.equal('error')
      expect(field.errors.map(e => e.message)).to.deep.equal(['boom'])
   })

   it('does NOT log for the degraded load (field-producing op)', () => {
      graph.dispatch(setOther('alive'))
      const verduxLogs = loggedMessages.filter(m => m.includes('[verdux]'))
      expect(verduxLogs).to.deep.equal([])
   })
})
