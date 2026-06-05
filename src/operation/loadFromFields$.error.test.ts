import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import {
   Observable,
   Subject,
   defer,
   map,
   switchMap,
   tap,
   throwError
} from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'
import { VertexRunData } from '../run/RunData'
import { makeLogger } from '../test/makeLogger'
import { loadFromFields$ } from './loadFromFields$'

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

describe('loadFromFields$() loader error', () => {
   let inputData$: Subject<VertexRunData>
   let latestInputData: VertexRunData
   let lowercase$: Subject<string>
   let uppercaseCallCount: number
   // Each input change runs the loader anew; `uppercaseBehaviour` decides the
   // source it produces for that run.
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
      const outputData$ = loadFromFields$(['name'], {
         lowercaseName: () => lowercase$,
         uppercaseName: (fields$: Observable<{ name: string }>) =>
            fields$.pipe(
               switchMap(() =>
                  defer(() => {
                     uppercaseCallCount++
                     return uppercaseBehaviour(uppercaseCallCount)
                  })
               )
            )
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

   // A loader that ERRORS its stream is terminal — its branch is built once
   // (outside any switchMap) and catchError completes it, so it can never emit
   // again. A later input change must therefore KEEP the field in error; it
   // must NOT reset the field to `loading` (which would strand it in a perpetual
   // loading state, since nothing will ever resolve it).
   describe('terminal stream error then a later input change', () => {
      const error = new Error('boom')
      const errorField = {
         status: 'error',
         value: undefined,
         errors: [error]
      }
      beforeEach(() => {
         uppercaseBehaviour = () => throwError(() => error)
         inputData$.next(createInitialRunData(loadedName('John')))
      })
      it('sets the field to error on the first failure', () => {
         expect(latestOutputData?.fields.uppercaseName).to.deep.equal(
            errorField
         )
      })
      it('keeps the field in error (not stuck loading) after a later input change', () => {
         inputData$.next({
            ...createInitialRunData(loadedName('Jane')),
            initialRun: false
         })
         expect(latestOutputData?.fields.uppercaseName).to.deep.equal(
            errorField
         )
      })
      it('leaves a healthy sibling loader free to reload on the later input change', () => {
         inputData$.next({
            ...createInitialRunData(loadedName('Jane')),
            initialRun: false
         })
         expect(latestOutputData?.fields.lowercaseName).to.deep.equal({
            status: 'loading',
            value: undefined,
            errors: []
         })
      })
   })
})

// Full-graph counterpart: drive the failure through the PUBLIC API only
// (createGraph + dispatch + currentLoadableState/currentState), exactly as a UI
// component would consume it. Proves the op contains its own stream error:
// degrades only its field to status:'error', keeps the sibling loaded and the
// graph alive, never logs, and (because the errored branch is terminal — its
// loader factory runs once at construction) keeps the field in error across a
// later input change instead of flipping it back to loading.
describe('loadFromFields$() loader error — full graph', () => {
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
      const rootVertexConfig = configureRootVertex({ slice }).loadFromFields$(
         ['name'],
         {
            // The loader is given an input$ stream; switchMap to an erroring
            // inner so the stream produces an error notification per input.
            upper: name$ =>
               name$.pipe(switchMap(() => throwError(() => new Error('boom')))),
            // Healthy sibling in the SAME loadFromFields$ map.
            lower: name$ => name$.pipe(map(({ name }) => name.toLowerCase()))
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

   it('keeps the field in error (not back to loading) after a later input change', () => {
      expect(vertex.currentLoadableState.fields.upper.status).to.equal('error')
      graph.dispatch(setName('Jane'))
      const field = vertex.currentLoadableState.fields.upper
      expect(field.status).to.equal('error')
      expect(field.errors.map(e => e.message)).to.deep.equal(['boom'])
   })

   it('does NOT log for the degraded load (field-producing op)', () => {
      // Trigger another input change too, to be sure no diagnostic is emitted.
      graph.dispatch(setName('Jane'))
      const verduxLogs = loggedMessages.filter(m => m.includes('[verdux]'))
      expect(verduxLogs).to.deep.equal([])
   })
})

// A loadFromFields$ loader is contracted to RETURN an Observable. Throwing when
// called or returning a non-Observable is a return-contract breach (a programming
// error), so it fails fast (throws eagerly at createGraph), not degraded.
describe('loadFromFields$ return-contract breach fails fast', () => {
   const makeConfig = (loader: any) =>
      configureRootVertex({
         slice: createSlice({ name: 'root', initialState: { x: 0 }, reducers: {} })
      }).loadFromFields$(['x'], { up: loader })

   it('throws at construction when the loader returns a non-observable', () => {
      const config = makeConfig(() => 'not an observable')
      expect(() => createGraph({ vertices: [config] })).to.throw(
         /must return an observable/
      )
   })

   it('fails fast when the loader itself throws when called', () => {
      const config = makeConfig(() => {
         throw new Error('loader-call-boom')
      })
      expect(() => createGraph({ vertices: [config] })).to.throw(
         'loader-call-boom'
      )
   })
})
