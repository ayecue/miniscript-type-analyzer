import { CompletionItem } from '../types/completion';
import { IEntity } from '../types/object';
import { aggregateEntity } from './aggregate-entities';

export const injectIdentifers = (
  properties: Map<string, CompletionItem>,
  source: IEntity
) => {
  const entities = aggregateEntity(source);

  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
    for (const [property, value] of entity.values) {
      if (property.startsWith('i:')) {
        const key = property.slice(2);
        if (properties.has(key)) {
          continue;
        }
        properties.set(key, {
          kind: value.kind,
          line: value.line
        });
      }
    }
  }
};
