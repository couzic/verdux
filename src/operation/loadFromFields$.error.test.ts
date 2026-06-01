import { expect } from 'chai'
import { Observable, Subject, defer, switchMap, tap, throwError } from 'rxjs'
import { VertexRunData } from '../run/RunData'
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
