import { LimitedUserRecord, UserRecord } from '@/modules/core/helpers/types'
import { Knex } from 'knex'
import { pick } from 'lodash'
import { UserEmails, Users } from '@/modules/core/dbSchema'

/**
 * Fields from the entity that users can see about other users
 */
export const LIMITED_USER_FIELDS: Array<keyof LimitedUserRecord> = [
  'id',
  'name',
  'bio',
  'company',
  'avatar',
  'createdAt'
]

/**
 * Remove fields from user that other users should not see/know about
 */
export function removePrivateFields(
  user: UserRecord | LimitedUserRecord
): LimitedUserRecord {
  if (!user) return user
  return pick(user, LIMITED_USER_FIELDS)
}

export type { LimitedUserRecord, UserRecord }
