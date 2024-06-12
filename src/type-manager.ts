import { ASTChunkAdvanced } from 'greybel-core';
import { Container } from 'meta-utils';
import { Document } from './type-manager/document';
import { CompletionItemKind } from './types/completion';
import { Entity } from './type-manager/entity';

export interface TypeManagerOptions {
  container: Container;
}

export class TypeManager {
  private _container: Container;

  constructor(options: TypeManagerOptions) {
    this._container = options.container;
  }

  analyze(chunk: ASTChunkAdvanced): Document {
    console.time();

    const doc = new Document({
      factory: (kind: CompletionItemKind) => {
        return new Entity({
          kind,
          container: this._container
        })
      },
      root: chunk
    });

    try {
      doc.analyze();
    } catch (err) {
      console.error(err);
    }

    console.timeEnd();

    return doc;
  }
}
