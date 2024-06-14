import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map, of } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { reaction$ } from './reaction$'
import { fakeBaseQuery } from '@reduxjs/toolkit/query'

const sut = reaction$

describe(sut.name, () => {
   it('reacts while passing payload', () => {
      const trackedAction = createAction<string>('trackedAction')
      const outputAction = createAction<string>('outputAction')
      const input: VertexRunData = {
         action: trackedAction('Bob'),
         fields: {},
         changedFields: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: false
      }
      let outputEmissions = 0
      let lastOutput: any = undefined
      reaction$(
         trackedAction,
         map(action => outputAction(action.payload))
      )(of(input)).subscribe(output => {
         outputEmissions++
         lastOutput = output
      })
      expect(outputEmissions).to.equal(2)
      expect(lastOutput).to.deep.equal({
         ...input,
         action: undefined,
         reactions: [outputAction('Bob')]
      })
   })

   it('ignores untracked action', () => {
      const trackedAction = createAction('trackedAction')
      const ignoredAction = createAction('ignoredAction')
      const outputAction = createAction('outputAction')
      const input: VertexRunData = {
         action: ignoredAction(),
         fields: {},
         changedFields: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      let outputEmissions = 0
      reaction$(
         trackedAction,
         map(action => outputAction(action.payload))
      )(of(input)).subscribe(() => outputEmissions++)
      expect(outputEmissions).to.equal(1)
   })

   it('has correct input', () => {
      const trackedAction = createAction('trackedAction')
      const outputAction = createAction('outputAction')
      const input: VertexRunData = {
         action: trackedAction(),
         fields: {
            name: {
               status: 'loaded',
               value: 'Bob',
               errors: []
            }
         },
         changedFields: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      let outputEmissions = 0
      let latestInput: any
      reaction$(
         trackedAction,
         map(input => {
            latestInput = input
            return outputAction()
         })
      )(of(input)).subscribe(() => {
         outputEmissions++
      })
      expect(latestInput.state).to.deep.equal({
         name: 'Bob'
      })
   })

   // TODO Output error
   // it('handles error in mapper', () => {
   //    const trackedAction = createAction('trackedAction')
   //    const outputAction = createAction('outputAction')
   //    const input: VertexRunData = {
   //       action: trackedAction(),
   //       fields: {},
   //       changedFields: {},
   //       fieldsReactions: [],
   //       reactions: []
   //    }
   //    let outputEmissions = 0
   //    reaction$(
   //       trackedAction,
   //       map(() => {
   //          throw new Error('error')
   //          return outputAction()
   //       })
   //    )(of(input)).subscribe(() => {
   //       outputEmissions++
   //    })
   //    expect(outputEmissions).to.equal(2)
   // })
})
