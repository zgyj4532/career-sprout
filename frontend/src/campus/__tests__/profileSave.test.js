import { expect, it } from 'vitest'
import { profileFields, reconcileProfileFields } from '../profileSave'

it('keeps unrelated concurrent changes and skips an already committed local edit', () => {
  const baseline = { bio: 'old', location: 'old city' }
  const local = { bio: 'saved bio', location: 'old city' }
  const canonical = { bio: 'saved bio', location: 'new city' }
  expect(reconcileProfileFields(baseline, local, canonical)).toEqual({ fields: canonical, conflicts: [], changed: false })
})

it('requires an explicit choice for same-field concurrent changes', () => {
  const result = reconcileProfileFields({ interests: ['old'] }, { interests: ['local'] }, { interests: ['remote'] })
  expect(result.conflicts).toEqual(['interests'])
  expect(result.fields.interests).toEqual(['local'])
  expect(result.changed).toBe(true)
})

it('always preserves unknown attendance explicitly even when a year is set', () => {
  expect(profileFields({ studyStage: '大三', collegeStudent: false, collegeStudentKnown: false })).toMatchObject({ studyStage: '大三', collegeStudent: null })
})
