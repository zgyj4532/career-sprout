import UserProfile from '../models/UserProfile.model.js'

export async function readFreshProfile(uid) {
  return UserProfile.findOne({ uid }).select('+phone +dateOfBirth +gender').lean()
}
