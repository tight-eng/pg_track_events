import KSUID from "ksuid";

export type KSUID_PREFIX = 'user' | 'account' | 'deal' | 'conn' | 'conn_user' | 'conn_evt' | 'conn_aust' | 'slack_msg'

export const KSUID_USER: KSUID_PREFIX = 'user'
export const KSUID_ACCOUNT: KSUID_PREFIX = 'account'
export const KSUID_DEAL: KSUID_PREFIX = 'deal'
export const KSUID_CONNECTION: KSUID_PREFIX = 'conn'
export const KSUID_CONNECTION_USER: KSUID_PREFIX = 'conn_user'
export const KSUID_CONNECTION_EVENT: KSUID_PREFIX = 'conn_evt'
export const KSUID_CONNECTION_AUTH_STATE: KSUID_PREFIX = 'conn_aust'
export const KSUID_SLACK_MESSAGE: KSUID_PREFIX = 'slack_msg'

export function generateKSUID(type: KSUID_PREFIX) {
  return `${type}_${KSUID.randomSync().string}`
}

export function isValidKSUID(id: string, prefix: KSUID_PREFIX) {
  const expectedPrefix = prefix + '_'
  if (id.startsWith(expectedPrefix)) {
    const withoutPrefix = id.slice(expectedPrefix.length)
    if (!/^[a-zA-Z0-9]+$/.test(withoutPrefix)) {
      // KSUIDs are only alphanumeric (no special characters)
      return false
    }
    // NOTE: KSUIDs are always 27 characters long
    return withoutPrefix.length === 27
  }
  return false
}
