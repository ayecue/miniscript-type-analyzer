import { ASTChunk } from 'miniscript-core';
import { Container } from 'meta-utils';
import { Document } from './type-manager/document';
import { TextDocumentLike, TypeManagerOptions } from './types/type-manager';


export class TypeManager {
  protected _container: Container;
  protected _types: Map<string, Document>;

  constructor(options: TypeManagerOptions) {
    this._container = options.container;
    this._types = new Map();
  }

  analyze(document: TextDocumentLike, chunk: ASTChunk): Document {
    console.time(`Analyzing for ${document.fileName} done within`);

    const typeDoc = new Document({
      container: this._container,
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
