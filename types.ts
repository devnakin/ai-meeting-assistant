export enum Status {
  IDLE,
  RECORDING,
  PROCESSING,
  DONE,
}

export interface TranscriptSegment {
  speaker?: string;
  text: string;
  startTime: string;
  endTime: string;
}
