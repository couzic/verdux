import { expect } from 'chai'
import { Observable, Subject, of, throwError } from 'rxjs'
import { VertexRunData } from '../run/RunData'
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
