export type IDPolicy = 'preferStored' | 'forceUpdate';

export interface IDGenerator {
  generate(): string;
}

export interface StableIdConfig {
  readonly id?: string;
  readonly generator?: IDGenerator;
  readonly policy?: IDPolicy;
}

export type ChangeSource = 'cloud' | 'manual';

export interface StableIdChangeEvent {
  readonly previousId: string | null;
  readonly newId: string;
  readonly source: ChangeSource;
}

export type WillChangeHandler = (currentId: string, candidateId: string) => string | null;
