export enum AppView {
  DOCKING = 'DOCKING',
  CHAT = 'CHAT',
  ANALYSIS = 'ANALYSIS',
  GENERATION = 'GENERATION',
  EDITOR = 'EDITOR'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface DockingConfig {
  exhaustiveness: number;
  numModes: number;
  energyRange: number;
}

export interface GridBox {
  center_x: number;
  center_y: number;
  center_z: number;
  size_x: number;
  size_y: number;
  size_z: number;
}

export interface PreparationSteps {
  // Protein Parameters
  removeWater: boolean;
  addForceField: boolean;
  forceFieldType: 'uff' | 'gaff' | 'mmff94' | 'ghemical'; // OpenBabel supported fields
  proteinProtonate: boolean;
  phLevel: number;
  
  // Ligand Parameters
  ligandProtonate: boolean;
  ligandChargeMethod: 'gasteiger' | 'mmff94' | 'qtpie' | 'qeq'; // Partial charge methods
  ligandMinimization: boolean;
}

export interface DockingResult {
  mode: number;
  affinity: number;
  rmsdLb: number;
  rmsdUb: number;
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '3:4',
  LANDSCAPE = '4:3',
  WIDE = '16:9',
  ULTRAWIDE = '21:9',
  MOBILE = '9:16'
}