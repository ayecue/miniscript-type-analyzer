import { Container, SignatureDefinitionBaseType, SignatureDefinitionType } from "meta-utils";
import { ContainerProxyOptions, IContainerProxy } from "./types/container-proxy";
import { IEntity } from "./types/object";
import { Entity, resolveEntity } from "./type-manager/entity";
import { CompletionItem, CompletionItemKind } from "./types/completion";
import { injectIdentifers } from "./utils/inject-identifiers";
import { lookupProperty } from "./utils/lookup-property";

export class ContainerProxy implements IContainerProxy {
  protected _container: Container;
  protected _primitives: Map<SignatureDefinitionBaseType, IEntity>;
  protected _types: Map<SignatureDefinitionType, IEntity>;
  protected _customTypes: string[];

  get primitives() {
    return this._primitives;
  }

  get types() {
    return this._types;
  }

  constructor(options: ContainerProxyOptions) {
    this._container = options.container;
    this._primitives = options.primitives ?? this.createPrimitives();
    this._types = options.types ?? this.createTypes();
    this._customTypes = [];
  }

  protected createPrimitives() {
    const primitives = new Map();

    for (const [type, signature] of this._container.getPrimitives()) {
      const signatureEntity = new Entity({
        kind: CompletionItemKind.Constant,
        container: this,
        isAPI: type === SignatureDefinitionBaseType.General
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(signature);

      primitives.set(type, signatureEntity);
    }

    return primitives;
  }

  protected createTypes() {
    const types = new Map();

    for (const [type, signature] of this._container.getTypes()) {
      const signatureEntity = new Entity({
        kind: CompletionItemKind.Constant,
        container: this
      })
        .addType(SignatureDefinitionBaseType.Map)
        .insertSignature(signature);

      types.set(type, signatureEntity);
    }

    return types;
  }

  setCustomType(type: SignatureDefinitionType, entitiy: IEntity): void {
    if (this._types.has(type)) return;
    this._types.set(type, entitiy);
    this._customTypes.push(type);
  }

  mergeCustomTypes(proxy: ContainerProxy): void {
    for (const type of proxy._customTypes) {
      const entity = proxy._types.get(type);
      if (entity == null) continue;
      this.setCustomType(type, entity.copy({
        disableCascade: true
      }));
    }
  }

  getTypeSignature(type: SignatureDefinitionType): IEntity | null {
    return this._primitives.get(type as SignatureDefinitionBaseType) ?? this._types.get(type) ?? null;
  }

  searchDefinitionMatches(types: string | SignatureDefinitionType[], property: string): Map<SignatureDefinitionType, IEntity> {
    if (typeof types === 'string') return this.searchDefinitionMatches([types], property);
    const typesSet = types.includes(SignatureDefinitionBaseType.Any) ? new Set(this._container.getAllVisibleTypes()) : new Set(types);
    const matches: Map<SignatureDefinitionType, IEntity> = new Map();

    for (const type of typesSet) {
      const current = this.getTypeSignature(type);
      if (current === null) continue;
      const match = lookupProperty(current, property);
      if (match === null) continue;
      matches.set(type, match);
    }

    return matches;
  }

  getDefinition(types: SignatureDefinitionType | SignatureDefinitionType[], property: string, noInvoke: boolean = false): IEntity | null {
    if (typeof types === 'string') return this.getDefinition([types], property);
    const internalAnyDef = lookupProperty(this._primitives.get(SignatureDefinitionBaseType.Any), property);

    if (types.includes(SignatureDefinitionBaseType.Any) && internalAnyDef) {
      return resolveEntity(this, internalAnyDef, noInvoke);
    }

    const matches = this.searchDefinitionMatches(types, property);

    if (matches.size === 0) {
      return null;
    } else if (matches.size === 1) {
      return resolveEntity(this, matches.values().next().value, noInvoke);
    }

    if (matches.has(SignatureDefinitionBaseType.Any)) {
      return resolveEntity(this, matches.get(SignatureDefinitionBaseType.Any), noInvoke);
    }

    if (internalAnyDef !== null) {
      return resolveEntity(this, internalAnyDef, noInvoke);
    }

    return resolveEntity(this, matches.values().next().value, noInvoke);
  }

  getGeneralDefinition(property: string, noInvoke: boolean = false): IEntity | null {
    const generalDef = lookupProperty(this._primitives.get(SignatureDefinitionBaseType.General), property);

    if (generalDef == null) {
      return null;
    }

    return resolveEntity(this, generalDef, noInvoke);
  }

  getAllIdentifier(type: string | SignatureDefinitionType): Map<string, CompletionItem> {
    const properties = new Map();

    if (type === SignatureDefinitionBaseType.Any) {
      for (const type of this._container.getAllVisibleTypes()) {
        const signature = this.getTypeSignature(type);
        if (signature != null) injectIdentifers(properties, signature);
      }

      return properties;
    }

    const signature = this.getTypeSignature(type);
    if (signature != null) injectIdentifers(properties, signature);

    return properties;
  }

  copy() {
    return new ContainerProxy({
      container: this._container
    });
  }
}