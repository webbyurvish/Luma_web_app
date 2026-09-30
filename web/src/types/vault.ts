export type VaultItemType = 'login' | 'card' | 'bank' | 'identity' | 'wifi' | 'note'

/** What gets encrypted — one JSON object per item. */
export interface VaultItemContent {
  type: VaultItemType
  title: string
  /** Free grouping such as Personal, Family, Work. */
  group: string
  favorite: boolean
  fields: Record<string, string>
  notes: string
}

export interface VaultItem extends VaultItemContent {
  id: string
  createdAt: string
  updatedAt: string
}

/** A row as the script stores it: opaque ciphertext. */
export interface RawVaultItem {
  id: string
  data: string
  createdAt: string
  updatedAt: string
}
