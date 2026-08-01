export type WardType = 'salon' | 'guard_room'
export type WardEventType = 'allocate' | 'deallocate' | 'manual' | 'guard_allocate' | 'guard_discharge' | 'triage_modification'

export interface Ward {
  id: string
  name: string
  type: WardType
  unit: string | null
  floor: string | null
  sortOrder: number
  active: boolean
}

export type CreateWardDTO = Omit<Ward, 'id'>
export type UpdateWardDTO = Partial<CreateWardDTO>

export interface WardBed {
  id: string
  wardId: string
  label: string
  x: number | null
  y: number | null
  rotation: number
  active: boolean
}

export type CreateWardBedDTO = Omit<WardBed, 'id'>
export type UpdateWardBedDTO = Partial<CreateWardBedDTO>

export interface WardBedWithOccupant extends WardBed {
  activeAllocation: {
    id: string
    patientId: string
    allocatedAt: Date
  } | null
}

export interface WardBedAllocation {
  id: string
  wardId: string
  bedId: string
  patientId: string
  allocatedAt: Date
  releasedAt: Date | null
  allocatedByUserId: string
  releasedByUserId: string | null
  notes: string | null
  version: number
}

export type CreateWardBedAllocationDTO = Omit<WardBedAllocation, 'id' | 'allocatedAt' | 'releasedAt' | 'releasedByUserId' | 'version'>
export type UpdateWardBedAllocationDTO = Partial<Pick<WardBedAllocation, 'notes'>>

export interface GuardRoomAssignment {
  id: string
  wardId: string
  patientId: string
  triageLevel: number
  triageAt: Date
  assignedAt: Date
  dischargedAt: Date | null
  assignedByUserId: string
  dischargedByUserId: string | null
  notes: string | null
  version: number
}

export type CreateGuardRoomAssignmentDTO = Omit<GuardRoomAssignment, 'id' | 'assignedAt' | 'dischargedAt' | 'dischargedByUserId' | 'version'>
export type UpdateGuardRoomAssignmentDTO = Partial<Pick<GuardRoomAssignment, 'triageLevel' | 'triageAt' | 'notes'>>

export interface WardEvent {
  id: string
  wardId: string
  bedId: string | null
  patientId: string | null
  patientName: string
  userId: string
  userName: string
  eventType: WardEventType
  createdAt: Date
  description: string | null
}

export type CreateWardEventDTO = Omit<WardEvent, 'id' | 'createdAt'>
