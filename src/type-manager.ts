import { ASTChunkAdvanced } from 'greybel-core';
import { Container } from 'meta-utils';
import { Document } from './type-manager/document';
import { CompletionItemKind } from './types/completion';
import { Entity } from './type-manager/entity';
import { TextDocumentLike } from './types/type-manager';

export interface TypeManagerOptions {
  container: Container;
}

export class TypeManager {
  protected _container: Container;
  protected _types: Map<string, Document>;

  constructor(options: TypeManagerOptions) {
    this._container = options.container;
    this._types = new Map();
  }

  analyze(document: TextDocumentLike, chunk: ASTChunkAdvanced): Document {
    console.time(`Analyzing for ${document.fileName} done within`);

    const typeDoc = new Document({
      factory: (kind: CompletionItemKind) => {
        return new Entity({
          kind,
          container: this._container
        })
      },
      root: chunk
    });

    try {
      typeDoc.analyze();
    } catch (err) {
      console.error(err);
    }

    console.timeEnd(`Analyzing for ${document.fileName} done within`);

    const key = document.fileName;
    this._types.set(key, typeDoc);

    return typeDoc;
  }

  get(document: TextDocumentLike): Document | null {
    return this._types.get(document.fileName) ?? null;
  }
}
