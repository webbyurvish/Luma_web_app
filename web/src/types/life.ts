export type VehicleType = 'Car' | 'Bike' | 'Scooter' | 'Auto' | 'Other'

export interface Vehicle {
  id: string
  name: string
  type: VehicleType
  registrationNumber: string
  fuel: string
  owner: string
  /** yyyy-MM-dd or '' */
  insuranceExpiry: string
  pucExpiry: string
  nextServiceDate: string
  nextServiceKm: number | null
  remindDaysBefore: number
  isActive: boolean
  notes?: string
}

export interface VehicleInput {
  name: string
  type: VehicleType
  registrationNumber: string
  fuel: string
  owner: string
  insuranceExpiry: string
  pucExpiry: string
  nextServiceDate: string
  nextServiceKm: number | null
  remindDaysBefore: number
  isActive: boolean
  notes: string
}

export type VehicleLogKind = 'Fuel' | 'Service' | 'Repair' | 'Insurance' | 'PUC' | 'Tyres' | 'Wash' | 'Toll & parking' | 'Odometer' | 'Other'

export interface VehicleLog {
  id: string
  vehicleId: string
  date: string
  kind: VehicleLogKind
  amount: number
  odometer: number | null
  /** Litres (kg for CNG, kWh for EV). */
  quantity: number | null
  fullTank: boolean
  place: string
  /** The Luma transaction this came from, if any. */
  transactionId: string
  note: string
}

export interface VehicleLogInput {
  vehicleId: string
  date: string
  kind: VehicleLogKind
  amount: number
  odometer: number | null
  quantity: number | null
  fullTank: boolean
  place: string
  transactionId: string
  note: string
}

export type MedicalKind = 'Doctor' | 'Hospital' | 'Lab test' | 'Medicines' | 'Health check-up' | 'Insurance premium' | 'Dental' | 'Eye' | 'Other'
export type ClaimStatus = 'Not claimed' | 'Claim filed' | 'Reimbursed' | 'Partly reimbursed' | 'Rejected' | 'Not claimable'

export interface MedicalBill {
  id: string
  person: string
  date: string
  kind: MedicalKind
  provider: string
  amount: number
  transactionId: string
  claimStatus: ClaimStatus
  insurer: string
  claimNumber: string
  claimedAmount: number | null
  reimbursedAmount: number | null
  driveFileId: string
  fileUrl: string
  notes: string
}

export interface MedicalBillInput {
  person: string
  date: string
  kind: MedicalKind
  provider: string
  amount: number
  transactionId: string
  claimStatus: ClaimStatus
  insurer: string
  claimNumber: string
  claimedAmount: number | null
  reimbursedAmount: number | null
  driveFileId: string
  fileUrl: string
  notes: string
}

type Cell = string | number | boolean | null

export interface RawVehicle {
  vehicleId: string
  name: Cell
  type: Cell
  registrationNumber: Cell
  fuel: Cell
  owner: Cell
  insuranceExpiry: Cell
  pucExpiry: Cell
  nextServiceDate: Cell
  nextServiceKm: Cell
  remindDaysBefore: Cell
  isActive: Cell
  notes: Cell
}

export interface RawVehicleLog {
  logId: string
  vehicleId: Cell
  date: Cell
  kind: Cell
  amount: Cell
  odometer: Cell
  quantity: Cell
  fullTank: Cell
  place: Cell
  transactionId: Cell
  note: Cell
}

export interface RawMedicalBill {
  billId: string
  person: Cell
  date: Cell
  kind: Cell
  provider: Cell
  amount: Cell
  transactionId: Cell
  claimStatus: Cell
  insurer: Cell
  claimNumber: Cell
  claimedAmount: Cell
  reimbursedAmount: Cell
  driveFileId: Cell
  fileUrl: Cell
  notes: Cell
}
