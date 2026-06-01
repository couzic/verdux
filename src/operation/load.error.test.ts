import { expect } from 'chai'
import { Observable, Subject, defer, tap, throwError } from 'rxjs'
import { VertexRunData } from '../run/RunData'
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
