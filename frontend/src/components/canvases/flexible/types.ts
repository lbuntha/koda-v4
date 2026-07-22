export interface FlexibleItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  targetBin?: string;
  type?: string;
}

export interface FlexibleTarget {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
