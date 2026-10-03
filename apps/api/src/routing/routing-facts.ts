import { routingFactsSchema, type RoutingFacts } from '@mobiflow/contracts';

export class RoutingFactsBuilder {
  build(request: { category: string | null; subcategory: string | null; priority: string }): RoutingFacts {
    return routingFactsSchema.parse({ category: request.category, subcategory: request.subcategory, priority: request.priority });
  }
}
