import { ASTChunkAdvanced } from 'greybel-core';
import { TypeScope } from './type-manager/scope';
import { Container } from 'meta-utils';

export interface TypeManagerOptions {
  container: Container;
}

export class TypeManager {
  private scope: TypeScope;
  private container: Container;

  constructor(options: TypeManagerOptions) {
    this.scope = new TypeScope({
      container: options.container
    });
    this.container = options.container;
  }

  analyze(chunk: ASTChunkAdvanced): this {
    console.time();

    try {
      this.scope.analyze(chunk);
    } catch (err) {
      console.error(err);
    }

    console.timeEnd();

    return this;
  }
}
