import { type RoutingCondition, type RoutingEvaluation, type RoutingFacts, type RoutingTargetView } from '@mobiflow/contracts';

export interface EffectiveRoutingRule {
  ruleId: string; revisionId: string; revision: number; ruleVersion: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'; name: string; priority: number;
  target: RoutingTargetView; conditions: RoutingCondition[];
}
const identity = (rule: EffectiveRoutingRule) => ({ ruleId: rule.ruleId, revisionId: rule.revisionId, revision: rule.revision, ruleVersion: rule.ruleVersion });
export class RoutingRuleEvaluator {
  evaluate(facts: RoutingFacts, requestVersion: number, rules: readonly EffectiveRoutingRule[]): RoutingEvaluation {
    const active = rules.filter(rule => rule.status === 'ACTIVE').slice().sort((a, b) => a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);
    const matches = active.map(rule => ({ ...identity(rule), name: rule.name, priority: rule.priority, target: { ...rule.target },
      explanation: rule.conditions.map(condition => {
        // Keys come only from the typed central allowlist, never a runtime object path.
        const actual = facts[condition.field];
        return { field: condition.field, operator: condition.operator, expected: [...condition.values], actual, matched: actual !== null && condition.values.some(value => value === actual) };
      }),
    })).filter(rule => rule.explanation.length > 0 && rule.explanation.every(condition => condition.matched));
    const best = matches.length ? Math.min(...matches.map(rule => rule.priority)) : null;
    const winners = matches.filter(rule => rule.priority === best);
    const base = { requestVersion, facts: { ...facts }, evaluatedRevisions: active.map(identity), ruleRevisions: winners, suggestedTarget: null };
    if (!winners.length) return { ...base, status: 'NO_MATCH', diagnostic: 'NO_ACTIVE_RULE_MATCHED' };
    if (new Set(winners.map(rule => rule.target.id)).size > 1) return { ...base, status: 'CONFLICT', diagnostic: 'CONFLICTING_TARGETS' };
    if (winners.some(rule => !rule.target.eligible)) return { ...base, status: 'NO_MATCH', diagnostic: 'INVALID_TARGET' };
    return { ...base, status: 'MATCH', diagnostic: 'MATCHED', suggestedTarget: { ...winners[0]!.target } };
  }
}
