import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, map, mergeMap, of, throwError } from 'rxjs'
import { VertexRunData } from '../run/RunData'
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

   describe('when the mapper throws synchronously', () => {
      beforeEach(() => {
         latestOutputData = undefined
         outputStreamErrored = false
         outputStreamCompleted = false
         inputData$ = new Subject()

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
               )
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
               )
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

      it('still reacts to a later tracked action after the error', () => {
         inputData$.next(createInput(trackedAction('first')))
         inputData$.next(createInput(trackedAction('second')))
         expect(latestOutputData?.reactions).to.deep.equal([
            outputAction('recovered')
         ])
      })
   })
})
