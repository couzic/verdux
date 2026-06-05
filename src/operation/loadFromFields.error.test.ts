import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Observable, Subject, of, throwError } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'
import { VertexRunData } from '../run/RunData'
import { makeLogger } from '../test/makeLogger'
import { loadFromFields } from './loadFromFields'

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

const loadedName = (value: string) => ({
   name: {
      status: 'loaded' as const,
      value,
      errors: [] as []
   }
})

describe('loadFromFields() loader error', () => {
   let inputData$: Subject<VertexRunData>
   let lowercase$: Subject<string>
   let uppercaseCallCount: number
   // Unlike loadFromFields$, the non-$ variant recreates its loaders on every
   // input change (inside switchMap), so the factory below is re-invoked per
   // run and `uppercaseBehaviour` decides the source for that run.
   let uppercaseBehaviour: (call: number) => Observable<any>
   let latestOutputData: VertexRunData | undefined
   let outputStreamErrored: boolean
   let outputStreamCompleted: boolean

   beforeEach(() => {
      latestOutputData = undefined
      outputStreamErrored = false
      outputStreamCompleted = false
      uppercaseCallCount = 0
      inputData$ = new Subject()
      lowercase$ = new Subject()
      const outputData$ = loadFromFields(['name'], {
         lowercaseName: () => lowercase$,
         uppercaseName: () => {
            uppercaseCallCount++
            return uppercaseBehaviour(uppercaseCallCount)
         }
      })(inputData$)
      outputData$.subscribe({
         next: outputData => (latestOutputData = outputData),
         error: () => (outputStreamErrored = true),
         complete: () => (outputStreamCompleted = true)
      })
   })

   describe('when a loader ERRORS its stream', () => {
      const error = new Error('boom')
      beforeEach(() => {
         uppercaseBehaviour = () => throwError(() => error)
         inputData$.next(createInitialRunData(loadedName('John')))
         lowercase$.next('john')
      })
      it('sets ONLY the failing field to status error with the error captured', () => {
         expect(latestOutputData?.fields.uppercaseName).to.deep.equal({
            status: 'error',
            value: undefined,
            errors: [error]
         })
      })
      it('leaves the other loadable field and the input field intact', () => {
         expect(latestOutputData?.fields.lowercaseName).to.deep.equal({
            status: 'loaded',
            value: 'john',
            errors: []
         })
         expect(latestOutputData?.fields.name).to.deep.equal({
            status: 'loaded',
            value: 'John',
            errors: []
         })
      })
      it('does NOT terminate the vertex stream', () => {
         expect(outputStreamErrored).to.be.false
         expect(outputStreamCompleted).to.be.false
      })
   })

   // The contract that distinguishes this operation from loadFromFields$: a
   // terminal stream error is NOT permanent here, because the loader is rebuilt
   // on the next input change. A later input that succeeds restores `loaded`.
   describe('terminal stream error then a later input change', () => {
      const error = new Error('boom')
      beforeEach(() => {
         uppercaseBehaviour = call =>
            call === 1 ? throwError(() => error) : of('JANE')
         inputData$.next(createInitialRunData(loadedName('John')))
      })
      it('errors on the first run', () => {
         expect(latestOutputData?.fields.uppercaseName).to.deep.equal({
            status: 'error',
            value: undefined,
            errors: [error]
         })
      })
      it('re-runs the loader and recovers to loaded on a later input change', () => {
         inputData$.next({
            ...createInitialRunData(loadedName('Jane')),
            initialRun: false
         })
         expect(uppercaseCallCount).to.be.greaterThan(1)
         expect(latestOutputData?.fields.uppercaseName).to.deep.equal({
            status: 'loaded',
            value: 'JANE',
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
// field). Unlike loadFromFields$, this op REBUILDS its loaders on every input
// change, so a later input that succeeds restores the field to `loaded`.
describe('loadFromFields() loader error — full graph', () => {
   const makeSlice = () =>
      createSlice({
         name: 'root',
         initialState: { name: 'John', other: '' },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            },
            setOther: (state, action: PayloadAction<string>) => {
               state.other = action.payload
            }
         }
      })

   let graph: ReturnType<typeof createGraph>
   let vertex: ReturnType<typeof graph.getVertexInstance>
   let setName: (name: string) => PayloadAction<string>
   let setOther: (other: string) => PayloadAction<string>
   let loggedMessages: string[]

   beforeEach(() => {
      const { logger, messages } = makeLogger()
      loggedMessages = messages

      const slice = makeSlice()
      setName = slice.actions.setName
      setOther = slice.actions.setOther
      const rootVertexConfig = configureRootVertex({ slice }).loadFromFields(
         ['name'],
         {
            // Errors while name is 'John', succeeds otherwise. Because the op
            // rebuilds its loaders on each input change, a later name recovers.
            upper: ({ name }: { name: string }) =>
               name === 'John'
                  ? throwError(() => new Error('boom'))
                  : of(name.toUpperCase()),
            // Healthy sibling in the SAME loadFromFields map.
            lower: ({ name }: { name: string }) => of(name.toLowerCase())
         }
      )
      graph = createGraph({ vertices: [rootVertexConfig], logger })
      vertex = graph.getVertexInstance(rootVertexConfig)
   })

   it('degrades ONLY the failing field to error, sibling stays loaded', () => {
      const ls = vertex.currentLoadableState
      expect(ls.fields.upper.status).to.equal('error')
      expect(ls.fields.upper.value).to.equal(undefined)
      expect(ls.fields.upper.errors.map(e => e.message)).to.deep.equal(['boom'])
      expect(ls.fields.lower.status).to.equal('loaded')
      expect(ls.fields.lower.value).to.equal('john')
   })

   it('keeps the graph alive: a later unrelated dispatch is still processed', () => {
      graph.dispatch(setOther('alive'))
      expect(vertex.currentState.other).to.equal('alive')
      // The errored field and sibling are still readable: nothing was torn down.
      expect(vertex.currentLoadableState.fields.upper.status).to.equal('error')
      expect(vertex.currentLoadableState.fields.lower.status).to.equal('loaded')
   })

   it('recovers the field to loaded on a later input change (loaders rebuilt)', () => {
      expect(vertex.currentLoadableState.fields.upper.status).to.equal('error')
      graph.dispatch(setName('Jane'))
      const field = vertex.currentLoadableState.fields.upper
      expect(field.status).to.equal('loaded')
      expect(field.value).to.equal('JANE')
   })

   it('does NOT log for the degraded load (field-producing op)', () => {
      graph.dispatch(setName('Jane'))
      const verduxLogs = loggedMessages.filter(m => m.includes('[verdux]'))
      expect(verduxLogs).to.deep.equal([])
   })
})
