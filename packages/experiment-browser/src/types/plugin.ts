import { ExperimentConfig } from '../config';

import { Client } from './client';
import { ExperimentUser } from './user';

type PluginTypeIntegration = 'integration';

export type ExperimentPluginType = PluginTypeIntegration;

export interface ExperimentPlugin {
  name?: string;
  type?: ExperimentPluginType;
  setup?(config: ExperimentConfig, client: Client): Promise<void>;
  teardown?(): Promise<void>;
}

export type ExperimentEvent = {
  eventType: string;
  eventProperties?: Record<string, unknown>;
  time?: number;
};

export interface IntegrationPlugin extends ExperimentPlugin {
  type: PluginTypeIntegration;
  getUser(): ExperimentUser;
  track(event: ExperimentEvent): boolean;
}
