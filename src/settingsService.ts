import { db } from './db/pool'

interface AppSettings {
  darkMode: boolean
  sessionTimeoutMinutes: number
  defaultUserRole: 'ADMIN' | 'DOCTOR'
  allowAccountCreation: boolean
}

let settings: AppSettings = {
  darkMode: false,
  sessionTimeoutMinutes: 120,
  defaultUserRole: 'DOCTOR',
  allowAccountCreation: false,
}

export function getSettings(): AppSettings {
  return settings
}

export function updateSettingsInMemory(updated: Partial<AppSettings>): void {
  settings = { ...settings, ...updated }
}

export async function loadSettingsFromDb(): Promise<void> {
  const result = await db.query('SELECT key, value FROM app_settings')
  const map = new Map<string, string>(result.rows.map((r: any) => [r.key, r.value]))

  settings = {
    darkMode: map.get('dark_mode_enabled') === 'true',
    sessionTimeoutMinutes: Number(map.get('session_timeout_minutes') || 120),
    defaultUserRole: (map.get('default_user_role') || 'DOCTOR') as 'ADMIN' | 'DOCTOR',
    allowAccountCreation: map.get('allow_account_creation') === 'true',
  }
}
