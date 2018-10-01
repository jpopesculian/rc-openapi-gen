import "reflect-metadata";
import {
  getMetadataArgsStorage,
  MetadataArgsStorage
} from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import { SchemaObject, OpenAPIObject } from "openapi3-ts";
import {
  ParamMetadataArgs
} from "routing-controllers/metadata/args/ParamMetadataArgs";
import fs from "fs";
import path from "path";
import _ from "lodash";
import glob from "glob";
import { Config } from "./interfaces";

interface MetadataSchemaObject {
  obj: SchemaObject
}

const buildSchemas = (fileglob, baseSchema): SchemaObject =>
  new Promise((resolve, reject) => {
    const root = process.cwd();
    const schema = baseSchema;
    glob(fileglob, {}, (err, files) => {
      if (err) {
        reject(err);
      }
      for (let file of files) {
        const filename = path.join(root, file);
        var stat = fs.lstatSync(filename);
        if (!stat.isDirectory() && filename.indexOf(".js") >= 0) {
          const apiSchema: SchemaObject = require(filename).default;
          Object.entries(apiSchema).forEach(([key, value]) => {
            if (value.id != key) {
              apiSchema[value.id] = value;
              delete apiSchema[key];
            }
          });
          Object.assign(schema, apiSchema);
        }
      }
      resolve(schema);
    });
  });

const buildControllers = (fileglob): Promise<Array<Function>> =>
  new Promise((resolve, reject) => {
    const root = process.cwd();
    glob(fileglob, {}, (err, files) => {
      if (err) {
        reject(err);
      }
      resolve(
        files
          .map(file => path.join(root, file))
          .map(filename => require(filename))
          .map(imported => _.first(_.filter(_.values(imported), _.isFunction)))
      );
    });
  });

const generateCodeSamples = (
  spec: OpenAPIObject,
  config: Config["samples"]
) => {
  const root = path.join(process.cwd(), config.dir)
  _.forEach(_.entries(spec.paths), ([pathObj, methods]) => {
      _.forEach(_.entries(methods), ([method, operation]) => {
        spec.paths[pathObj][method]['x-code-samples'] = _.reject(
          _.map(_.entries(config.languages), ([lang, {extension}]) => {
            const filename = path.join(root, lang, `${operation.operationId}.${method}.${extension}`)
            let source = ''
            if (fs.existsSync(filename)) {
                source = fs.readFileSync(filename).toString()
            }
            if (_.isEmpty(source)) { return null; }
            return { lang, source };
          }),
          _.isEmpty
        )
      });
  })
};

const createParamType = (
  { obj }: MetadataSchemaObject,
  schemas: SchemaObject
): Function => {
  let name = obj.id;
  if (!name) {
    const foundSchema = _.find(_.values(schemas), obj);
    if (!(foundSchema && foundSchema.id)) {
      return undefined;
    }
    name = foundSchema.id;
  }
  const result = () => {};
  Object.defineProperty(result, "name", {
    value: name
  });
  return result;
};

const copyParamSchema = (
  param: ParamMetadataArgs,
  schemas: SchemaObject
): void => {
  const { index, object, method } = param;
  const appSchema: Array<MetadataSchemaObject> = Reflect.getMetadata(
    "__schema",
    object,
    method
  );
  if (!(_.isArray(appSchema) && _.isObject(appSchema[index]))) {
    return;
  }
  const openAPIschema = Reflect.getMetadata(
    "design:paramtypes",
    object,
    method
  ) || [];
  openAPIschema[index] = createParamType(appSchema[index], schemas);
  Reflect.defineMetadata("design:paramtypes", openAPIschema, object, method);
};

const copyReflectMetadata = (
  storage: MetadataArgsStorage,
  schemas: SchemaObject
): void => {
  storage.params.map(param => copyParamSchema(param, schemas));
};

export default async (config: Config) => {
  const routingControllerOptions = {
    controllers: await buildControllers(config.controllers)
  };
  const schemas = await buildSchemas(config.schemas, config.baseSchema);
  const storage = getMetadataArgsStorage();
  copyReflectMetadata(storage, schemas);
  const spec = routingControllersToSpec(
    storage,
    routingControllerOptions,
    Object.assign(
      {
        components: { schemas }
      },
      config.static
    )
  );
  generateCodeSamples(spec, config.samples);
  fs.writeFileSync(config.out, JSON.stringify(spec, null, 2));
};
