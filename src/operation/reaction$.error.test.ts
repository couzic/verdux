import { PayloadAction, createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, map, mergeMap, of, throwError } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'
import { VertexRunData } from '../run/RunData'
import { makeLogger } from '../test/makeLogger'
import { reaction$ } from './reaction$'

const createInput = (action: any): VertexRunData => ({
   action,
   fields: {
      name: { status: 'loaded', value: 'Bob', errors: [] }
   },
   changedFields: {},
   fieldsReactions: [],
   reactions: [],
   sideEffects: [],
   initialRun: false
})

describe('reaction$() mapper error', () => {
   const trackedAction = createAction<string>('trackedAction')
   const outputAction = createAction<string>('outputAction')

   let inputData$: Subject<VertexRunData>
   let latestOutputData: VertexRunData | undefined
   let outputStreamErrored: boolean
   let outputStreamCompleted: boolean
   let logged: (fragment: string) => boolean

   describe('when the mapper throws synchronously', () => {
      beforeEach(() => {
         latestOutputData = undefined
         outputStreamErrored = false
         outputStreamCompleted = false
         inputData$ = new Subject()
         const captured = makeLogger()
         logged = captured.logged

         let callCount = 0
         const outputData$ = reaction$(
            trackedAction,
            input$ =>
               input$.pipe(
                  map(() => {
                     callCount++
                     if (callCount === 1) {
                        throw new Error('sync-boom')
                     }
                     return outputAction('recovered')
                  })
               ),
            captured.logger
         )(inputData$)

         outputData$.subscribe({
            next: data => (latestOutputData = data),
            error: () => (outputStreamErrored = true),
            complete: () => (outputStreamCompleted = true)
         })
      })

      it('does NOT terminate the output stream', () => {
         inputData$.next(createInput(trackedAction('first')))
         expect(outputStreamErrored).to.be.false
         expect(outputStreamCompleted).to.be.false
      })

      it('logs the error through the injected logger', () => {
         inputData$.next(createInput(trackedAction('first')))
         expect(logged('reaction$ on "trackedAction" threw')).to.equal(true)
      })

      it('still reacts to a later tracked action after the error', () => {
         inputData$.next(createInput(trackedAction('first')))
         inputData$.next(createInput(trackedAction('second')))
         expect(latestOutputData?.reactions).to.deep.equal([
            outputAction('recovered')
         ])
      })
   })

   describe('when the mapper errors its observable', () => {
      beforeEach(() => {
         latestOutputData = undefined
         outputStreamErrored = false
         outputStreamCompleted = false
         inputData$ = new Subject()
         const captured = makeLogger()
         logged = captured.logged

         let callCount = 0
         const outputData$ = reaction$(
            trackedAction,
            input$ =>
               input$.pipe(
                  mergeMap(() => {
                     callCount++
                     if (callCount === 1) {
                        return throwError(() => new Error('async-boom'))
                     }
                     return of(outputAction('recovered'))
                  })
               ),
            captured.logger
         )(inputData$)

         outputData$.subscribe({
            next: data => (latestOutputData = data),
            error: () => (outputStreamErrored = true),
            complete: () => (outputStreamCompleted = true)
         })
      })

      it('does NOT terminate the output stream', () => {
         inputData$.next(createInput(trackedAction('first')))
         expect(outputStreamErrored).to.be.false
         expect(outputStreamCompleted).to.be.false
      })

      it('logs the error through the injected logger', () => {
         inputData$.next(createInput(trackedAction('first')))
         expect(logged('reaction$ on "trackedAction" threw')).to.equal(true)
      })

      it('still reacts to a later tracked action after the error', () => {
         inputData$.next(createInput(trackedAction('first')))
         inputData$.next(createInput(trackedAction('second')))
         expect(latestOutputData?.reactions).to.deep.equal([
            outputAction('recovered')
         ])
      })
   })
})

// Full-graph proof, via the PUBLIC API only, that a throwing reaction$ mapper
// stream is logged (not silently swallowed, not left uncaught) while the graph
// stays alive and the stream recovers for later tracked actions. Mirrors the
// reaction/sideEffect blocks in graph/graphErrorResilience.test.ts. This is a
// fail-on-revert guard: removing reaction$.ts's catchError makes it red.
describe('reaction$() full-graph error resilience', () => {
   const makeGraph = () => {
      const { logger, logged } = makeLogger()
      const slice = createSlice({
         name: 'root',
         initialState: { n: 0 },
         reducers: {
            trig: () => {},
            set: (s, a: PayloadAction<number>) => {
               s.n = a.payload
            }
         }
      })
      let callCount = 0
      const config = configureRootVertex({ slice }).reaction$(
         slice.actions.trig,
         input$ =>
            input$.pipe(
               mergeMap(() => {
                  callCount++
                  if (callCount === 1) {
                     return throwError(() => new Error('reaction$ boom'))
                  }
                  return of(slice.actions.set(42))
               })
            )
      )
      const graph = createGraph({ vertices: [config], logger })
      return { graph, slice, vertex: graph.getVertexInstance(config), logged }
   }

   it('logs the error', () => {
      const { graph, slice, logged } = makeGraph()
      graph.dispatch(slice.actions.trig())
      expect(logged('reaction$ on "root/trig" threw')).to.equal(true)
   })

   it('keeps the graph alive: a later unrelated dispatch is still processed', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.trig()) // mapper stream errors, logged
      graph.dispatch(slice.actions.set(5)) // later, unrelated dispatch
      expect(vertex.currentState.n).to.equal(5)
   })

   it('recovers the reaction for a later tracked action after the error', () => {
      const { graph, slice, vertex } = makeGraph()
      graph.dispatch(slice.actions.trig()) // first → mapper errors, swallowed
      graph.dispatch(slice.actions.trig()) // second → mapper re-dispatches set(42)
      expect(vertex.currentState.n).to.equal(42)
   })
})

// A reaction$ mapper is contracted to RETURN an Observable. Breaching that — the
// mapper function itself throwing when called, or returning a non-Observable — is
// a programming error, not a runtime stream error, so it fails fast (like every
// other Observable-returning callback) rather than being logged and skipped. Only
// an error delivered THROUGH the returned stream is logged + skipped (above).
describe('reaction$() return-contract breach fails fast', () => {
   const tracked = createAction('tracked')
   const makeConfig = (mapper: any) =>
      configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      }).reaction$(tracked, mapper)

   it('throws at construction when the mapper returns a non-observable', () => {
      const config = makeConfig(() => 'not an observable')
      expect(() => createGraph({ vertices: [config] })).to.throw(
         /reaction\$ .*must return an observable/
      )
   })

   it('fails fast when the mapper function itself throws when called', () => {
      const config = makeConfig(() => {
         throw new Error('mapper-call-boom')
      })
      expect(() => createGraph({ vertices: [config] })).to.throw(
         'mapper-call-boom'
      )
   })
})
