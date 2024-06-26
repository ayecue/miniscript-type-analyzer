import { CompletionItem } from '../types/completion';
import { IEntity } from '../types/object';

export const injectIdentifers = (
  properties: Map<string, CompletionItem>,
  source: IEntity
) => {
  for (const [property, entity] of source.values) {
    if (property.startsWith('i:')) {
      properties.set(property.slice(2), {
        kind: entity.kind,
        line: entity.line
      });
    }
  }
};
