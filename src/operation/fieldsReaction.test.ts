import { createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { VertexStatus } from '../vertex/VertexStatus'
import { fieldsReaction } from './fieldsReaction'

// The `fieldsReaction` mapper must type a loadable field's picked value as status-aware
// (`value | undefined`), not as the always-loaded value. Never called — its sole purpose
// is to be type-checked. The `@ts-expect-error` goes red as TS2578 ("unused directive")
// if the type is too loose and the loadable-field access compiles.
export function _fieldsReactionPickedTypeProbe() {
   const root = configureRootVertex({
      slice: createSlice({
         name: 'root',
         initialState: { name: 'Bob' },
         reducers: {}
      })
   }).load({ data: of({ n: 1 }) })

   root.fieldsReaction(['name', 'data'], picked => {
      // Non-loadable slice field: always present, must stay non-undefined.
      picked.name.toUpperCase()
      // @ts-expect-error loadable field is `undefined` when loading/error
      picked.data.n
      return null
   })
}

const createRunData = (fieldValues: Record<string, any>): VertexRunData => {
   const fields: VertexFields = {}
   const changedFields: Record<string, true> = {}
   Object.keys(fieldValues).forEach(fieldName => {
      fields[fieldName] = {
         status: 'loaded',
         value: fieldValues[fieldName],
         errors: []
      }
      changedFields[fieldName] = true
   })
   return {
      action: undefined,
      fields,
      changedFields,
      fieldsReactions: [],
      reactions: [],
      sideEffects: [],
      initialRun: false
   }
}

describe(fieldsReaction.name, () => {
   it('ignores initial values', () => {
      const input = {
         ...createRunData({ name: 'Bob' }),
         initialRun: true as const
      }
      let callsToMapper = 0
      fieldsReaction(['name'], () => {
         callsToMapper++
         return null
      })(of(input)).subscribe()
      expect(callsToMapper).to.equal(0)
   })

   it('reacts to tracked field change', () => {
      const outputAction = createAction<string>('outputAction')
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      fieldsReaction(['name'], ({ name }: any) => outputAction(name))(
         of(input)
      ).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsReactions: [outputAction('Bob')]
      })
   })

   it('has access to loadable state', () => {
      const outputAction = createAction<string>('outputAction')
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      let accessedStatus: VertexStatus | undefined = undefined
      fieldsReaction(['name'], ({ name }: any, { status }: any) => {
         accessedStatus = status
         return outputAction(name)
      })(of(input)).subscribe(output => (lastOutput = output))
      expect(accessedStatus).to.equal('loaded')
   })

   it('ignores null mapper outputs', () => {
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      fieldsReaction(['name'], ({ name }: any) => {
         return null
      })(of(input)).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.equal(input)
   })
})
