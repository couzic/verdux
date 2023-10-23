import { expect } from 'chai'
import { internalStateEquals } from './internalStateEquals'

describe(internalStateEquals.name, () => {
   it('compares identical internal states', () => {
      expect(
         internalStateEquals(
            {
               versions: {},
               reduxState: {
                  vertex: { username: '', flag: false },
                  downstream: {}
               },
               readonlyFields: {},
               loadableFields: {}
            },
            {
               versions: {},
               reduxState: {
                  vertex: { username: '', flag: false },
                  downstream: {}
               },
               readonlyFields: {},
               loadableFields: {}
            }
         )
      ).to.be.true
   })
   it('compares internal states with different redux vertex state value', () => {
      expect(
         internalStateEquals(
            {
               versions: {},
               reduxState: {
                  vertex: { username: '', flag: false },
                  downstream: {}
               },
               readonlyFields: {},
               loadableFields: {}
            },
            {
               versions: {},
               reduxState: {
                  vertex: { username: '', flag: true },
                  downstream: {}
               },
               readonlyFields: {},
               loadableFields: {}
            }
         )
      ).to.be.false
   })
   it('compares internal states with different redux vertex state value', () => {
      expect(
         internalStateEquals(
            {
               versions: {},
               reduxState: {
                  vertex: {},
                  downstream: { username: '', flag: false }
               },
               readonlyFields: {},
               loadableFields: {}
            },
            {
               versions: {},
               reduxState: {
                  vertex: {},
                  downstream: { username: '', flag: true }
               },
               readonlyFields: {},
               loadableFields: {}
            }
         )
      ).to.be.false
   })
})
