import { MessageBus } from './message-bus';

export interface WebExperimentStore {
  messageBus: MessageBus;
  location: string;
}
