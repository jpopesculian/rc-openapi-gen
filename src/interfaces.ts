import { SchemaObject, OperationObject, OpenAPIObject } from "openapi3-ts";

export interface PackageJSON {
  version: string,
  name: string
}

export interface Config {
  controllers: string,
  schemas: string,
  out: string,
  static: object
  baseSchema: SchemaObject,
  samples: {
    dir: string,
    languages: {
      [key: string]: {
        extension: string
      }
    }
  }
}
