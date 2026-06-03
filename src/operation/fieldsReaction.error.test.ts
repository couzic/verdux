import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject } from 'rxjs'
import * as sinon from 'sinon'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
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
   let errorStub: sinon.SinonStub

   // the mapper throws on purpose below; stub console.error so the
   // (intentional) diagnostic doesn't pollute the suite output.
   beforeEach(() => {
      errorStub = sinon.stub(console, 'error')
      latestOutputData = undefined
      outputStreamErrored = false
      outputStreamCompleted = false
      inputData$ = new Subject()

      let callCount = 0
      const outputData$ = fieldsReaction(['name'], ({ name }: any) => {
         callCount++
         if (callCount === 1) {
            throw new Error('sync-boom')
         }
         return outputAction(name)
      })(inputData$)

      outputData$.subscribe({
         next: data => (latestOutputData = data),
         error: () => (outputStreamErrored = true),
         complete: () => (outputStreamCompleted = true)
      })
   })

   afterEach(() => {
      errorStub.restore()
   })

   it('does NOT terminate the output stream when the mapper throws', () => {
      inputData$.next(createInput('first'))
      expect(outputStreamErrored).to.be.false
      expect(outputStreamCompleted).to.be.false
   })

   it('still reacts to a later field change after the error', () => {
      inputData$.next(createInput('first'))
      inputData$.next(createInput('second'))
      expect(latestOutputData?.fieldsReactions).to.deep.equal([
         outputAction('second')
      ])
   })
})
