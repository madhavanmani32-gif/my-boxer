export interface VaultImage {
  id?: number;
  title: string;
  category: string;
  base64: string;
  size: number;
  favorite: boolean;
  timestamp: number;
}

export interface VaultNote {
  id?: number;
  title: string;
  content: string;
  pinned: boolean;
  category: string;
  tags: string[];
  favorite: boolean;
  timestamp: number;
}

export interface VaultLink {
  id?: number;
  title: string;
  url: string;
  favorite: boolean;
  timestamp: number;
}

export interface VaultPassword {
  id?: number;
  service: string;
  username: string;
  password: string;
  category: string;
  favorite: boolean;
  strength: 'weak' | 'medium' | 'strong';
  timestamp: number;
}

export interface AppSettings {
  pin: string | null;
  biometricsEnabled: boolean;
  autoLockTimeout: number; // in seconds (e.g., 60, 300, 0 for off)
  isLocked: boolean;
  lastActive: number;
}

export type VaultItem = 
  | { type: 'image'; data: VaultImage }
  | { type: 'note'; data: VaultNote }
  | { type: 'link'; data: VaultLink }
  | { type: 'password'; data: VaultPassword };
