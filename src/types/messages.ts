import { InterceptedRequest, MockRule } from './rule';

export const MOCKFORGE_SOURCE = 'MOCKFORGE_INTERNAL_EVENT_BUS';

export type EventMessageType =
  | 'PING'
  | 'PONG'
  | 'REQUEST_INTERCEPTED'
  | 'GET_RULES'
  | 'RULES_UPDATED'
  | 'SET_GLOBAL_ENABLED';

export interface BaseMessage {
  source: typeof MOCKFORGE_SOURCE;
  type: EventMessageType;
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
  timestamp: number;
}

export interface RequestInterceptedMessage extends BaseMessage {
  type: 'REQUEST_INTERCEPTED';
  payload: InterceptedRequest;
}

export interface RulesUpdatedMessage extends BaseMessage {
  type: 'RULES_UPDATED';
  rules: MockRule[];
  globalEnabled: boolean;
}

export type MockForgeMessage =
  | PingMessage
  | RequestInterceptedMessage
  | RulesUpdatedMessage;
