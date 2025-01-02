import { CompletionItem } from '../types/completion';
import { IdentifierPropertyPattern, IEntity } from '../types/object';
import { aggregateEntity } from './aggregate-entities';

export const injectIdentifers = (
  properties: Map<string, CompletionItem>,
  source: IEntity
) => {
  const entities = aggregateEntity(source);

  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
    entity.values.forEach((value, property) => {
      if (property.startsWith(IdentifierPropertyPattern)) {
        const key = property.slice(2);
        if (properties.has(key)) {
          return;
        }
        properties.set(key, {
          kind: value.kind,
          line: value.source === source.source ? value.line : -1
        });
      }
    });
  }
};
