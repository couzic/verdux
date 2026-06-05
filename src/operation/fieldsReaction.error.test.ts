import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { makeLogger } from '../test/makeLogger'
import { fieldsReaction } from './fieldsReaction'

const createInput = (name: string): VertexRunData => {
   const fields: VertexFields = {
      name: { status: 'loaded', value: name, errors: [] }
   }
   return {
      action: undefined,
      fields,
      changedFields: { name: true },
      fieldsReactions: [],
      reactions: [],
      sideEffects: [],
      initialRun: false
   }
}

describe('fieldsReaction() mapper error', () => {
   const outputAction = createAction<string>('outputAction')

   let inputData$: Subject<VertexRunData>
   let latestOutputData: VertexRunData | undefined
   let outputStreamErrored: boolean
   let outputStreamCompleted: boolean
   let loggedMessages: string[]

   // the mapper throws on purpose below; pass a capturing logger so the
   // (intentional) diagnostic is observed here instead of hitting the console.
   beforeEach(() => {
      const captured = makeLogger()
      loggedMessages = captured.messages
      latestOutputData = undefined
      outputStreamErrored = false
      outputStreamCompleted = false
      inputData$ = new Subject()

      let callCount = 0
      const outputData$ = fieldsReaction(
         ['name'],
         ({ name }: any) => {
            callCount++
            if (callCount === 1) {
               throw new Error('sync-boom')
            }
            return outputAction(name)
         },
         captured.logger
      )(inputData$)

      outputData$.subscribe({
         next: data => (latestOutputData = data),
         error: () => (outputStreamErrored = true),
         complete: () => (outputStreamCompleted = true)
      })
   })

   it('does NOT terminate the output stream when the mapper throws', () => {
      inputData$.next(createInput('first'))
      expect(outputStreamErrored).to.be.false
      expect(outputStreamCompleted).to.be.false
   })

   it('logs the error through the injected logger', () => {
      inputData$.next(createInput('first'))
      expect(
         loggedMessages.some(m => m.includes('fieldsReaction on fields [name]'))
      ).to.equal(true)
   })

   it('still reacts to a later field change after the error', () => {
      inputData$.next(createInput('first'))
      inputData$.next(createInput('second'))
      expect(latestOutputData?.fieldsReactions).to.deep.equal([
         outputAction('second')
      ])
   })
})
