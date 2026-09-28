# M4 synthetic intake dataset v1

50 independently specified cases: 30 normal, 10 incomplete, 5 ambiguous, 5 noisy/colloquial. Written before running model predictions. Labels are specification-based annotations authored during implementation, not independent human adjudication or real customer data. Entity labels use explicit strings/null; no production information. ABC and every Demo identity are synthetic.

Category/priority/team expectations follow AI_BEHAVIOR_SPEC A06. Team is an annotation for later routing evaluation, not an M4 model field. `missingFields` lists required detection targets, not an exhaustive array; the report gives recall over labeled targets. Exact entity match uses NFC, trim, collapsed whitespace and lowercase for text, integer/null equality otherwise. Unlabeled entities are excluded with denominators reported. Failed/invalid cases remain incorrect in category/priority denominators.

Do not alter labels based on predictions. Report model limitations/misses and dataset hash. The prompt never receives expected labels, IDs or tags. This small synthetic set does not establish general accuracy. M9 owns broader evaluation and benchmarking.
