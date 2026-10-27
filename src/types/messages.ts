import { InterceptedRequest, MockRule } from './rule';

export const MOCKFORGE_SOURCE = 'MOCKFORGE_INTERNAL_EVENT_BUS';

export type EventMessageType =
  | 'PING'
  | 'PONG'
  | 'REQUEST_INTERCEPTED'
  | 'GET_RULES'
  | 'RULES_UPDATED'
  | 'SET_GLOBAL_ENABLED'
  | 'GET_REQUEST_LOGS'
  | 'CLEAR_REQUEST_LOGS'
  | 'REQUEST_LOGS_RESPONSE';

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

export interface GetRequestLogsMessage extends BaseMessage {
  type: 'GET_REQUEST_LOGS';
}

export interface ClearRequestLogsMessage extends BaseMessage {
  type: 'CLEAR_REQUEST_LOGS';
}

export interface RequestLogsResponseMessage extends BaseMessage {
  type: 'REQUEST_LOGS_RESPONSE';
  logs: InterceptedRequest[];
}

export type MockForgeMessage =
  | PingMessage
  | RequestInterceptedMessage
  | RulesUpdatedMessage
  | GetRequestLogsMessage
  | ClearRequestLogsMessage
  | RequestLogsResponseMessage;

