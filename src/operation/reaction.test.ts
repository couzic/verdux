import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { makeLogger } from '../test/makeLogger'
import { reaction } from './reaction'

const sut = reaction

describe(sut.name, () => {
   it('reacts', () => {
      const trackedAction = createAction('trackedAction')
      const outputAction = createAction('outputAction')
      const input: VertexRunData = {
         action: trackedAction(),
         fields: {},
         changedFields: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      let lastOutput: any = undefined
      reaction(trackedAction, () => outputAction())(of(input)).subscribe(
         output => (lastOutput = output)
      )
      expect(lastOutput).to.deep.equal({
         ...input,
         reactions: [outputAction()]
      })
   })
   it('handles error in action mapper', () => {
      const trackedAction = createAction('trackedAction')
      const input: VertexRunData = {
         action: trackedAction(),
         fields: {},
         changedFields: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      let lastOutput: any = undefined
      const { logger, logged } = makeLogger()
      reaction(
         trackedAction,
         () => {
            throw new Error('error')
         },
         logger
      )(of(input)).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal(input)
      expect(logged('reaction on "trackedAction" threw')).to.equal(true)
   })
})
