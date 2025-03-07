import { ASTChunk } from 'miniscript-core';
import { Document } from './type-manager/document';
import { TypeManagerOptions } from './types/type-manager';
import { ContainerProxy } from './container-proxy';


export class TypeManager {
  protected _container: ContainerProxy;
  protected _types: Map<string, Document>;

  constructor(options: TypeManagerOptions) {
    this._container = new ContainerProxy({
      container: options.container
    });
    this._types = new Map();
  }

  analyze(identifier: string, chunk: ASTChunk): Document {
    const typeDoc = new Document({
      source: identifier,
      container: this._container.copy(),
      root: chunk
    });

    try {
      typeDoc.analyze();
    } catch (err) {
      console.error(err);
    }

    this._types.set(identifier, typeDoc);

    return typeDoc;
  }

  get(identifier: string): Document | null {
    return this._types.get(identifier) ?? null;
  }
}
