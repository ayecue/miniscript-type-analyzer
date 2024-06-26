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
    console.time(`Analyzing for ${identifier} done within`);

    const typeDoc = new Document({
      container: this._container,
      root: chunk
    });

    try {
      typeDoc.analyze();
    } catch (err) {
      console.error(err);
    }

    console.timeEnd(`Analyzing for ${identifier} done within`);

    this._types.set(identifier, typeDoc);

    return typeDoc;
  }

  get(identifier: string): Document | null {
    return this._types.get(identifier) ?? null;
  }
}
