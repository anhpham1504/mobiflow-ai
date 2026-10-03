import type { ApiEnvironment } from '@mobiflow/config';
import { slaConsumedRatio, type assessSla } from './sla-clock.js';
export type SlaAlertConfig = Pick<ApiEnvironment, 'SLA_ALERT_ENABLED' | 'SLA_ALERT_EARLY_RATIO' | 'SLA_ALERT_AT_RISK_ENABLED' | 'SLA_ALERT_BREACH_ENABLED' | 'SLA_ALERT_INTERVAL_SECONDS' | 'SLA_ALERT_BATCH_SIZE' | 'SLA_ALERT_TIME_BUDGET_MS'>;
export function alertConfigIdentity(config: SlaAlertConfig) {
  return `m22.v1:${config.SLA_ALERT_EARLY_RATIO}:${config.SLA_ALERT_AT_RISK_ENABLED}:${config.SLA_ALERT_BREACH_ENABLED}`;
}
export function currentSlaAlert(sla: ReturnType<typeof assessSla>, config: SlaAlertConfig) {
  if (!config.SLA_ALERT_ENABLED || sla.pausedAt || sla.resolvedHoldAt || sla.stoppedAt) return null;
  if (sla.status === 'BREACHED') return config.SLA_ALERT_BREACH_ENABLED ? { eventType: 'SLA_BREACH_ESCALATION' as const, thresholdKey: 'CANONICAL_BREACH', notificationType: 'SLA_BREACHED', warningLevel: 'BREACHED', managers: true } : null;
  if (sla.status === 'AT_RISK') return config.SLA_ALERT_AT_RISK_ENABLED ? { eventType: 'SLA_AT_RISK_ESCALATION' as const, thresholdKey: 'CANONICAL_AT_RISK', notificationType: 'SLA_AT_RISK', warningLevel: 'AT_RISK', managers: true } : null;
  if (sla.status === 'SAFE' && slaConsumedRatio(sla) >= config.SLA_ALERT_EARLY_RATIO) return { eventType: 'SLA_REMINDER' as const, thresholdKey: 'EARLY_REMINDER_PRIMARY', notificationType: 'SLA_REMINDER', warningLevel: 'REMINDER', managers: false };
  return null;
}
