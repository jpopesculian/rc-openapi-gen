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
import { promisify } from "util";
import { Config } from "./interfaces";

interface MetadataSchemaObject {
  obj: SchemaObject
}

const getJsLibs = async fileglobs => {
  const asyncGlob = promisify(glob);
  const root = process.cwd();
  return []
    .concat(
      ...(await Promise.all(
        fileglobs.split(",").map(fileglob => asyncGlob(fileglob, {}))
      ))
    )
    .map(file => path.join(root, file))
    .filter(filename => {
      var stat = fs.lstatSync(filename);
      return !stat.isDirectory() && filename.indexOf(".js") >= 0;
    })
    .map(file => require(file));
};

const buildSchemas = async (fileglobs, baseSchema): Promise<SchemaObject> => {
  const schema = baseSchema;
  for (let lib of await getJsLibs(fileglobs)) {
    const apiSchema: SchemaObject = lib.default;
    Object.entries(apiSchema).forEach(([key, value]) => {
      if (value.id != key) {
        apiSchema[value.id] = value;
        delete apiSchema[key];
      }
    });
    Object.assign(schema, apiSchema);
  }
  return schema;
};

const buildControllers = async (fileglobs): Promise<Array<Function>> =>
  (await getJsLibs(fileglobs)).map(imported =>
    _.first(_.filter(_.values(imported), _.isFunction))
  );

const generateCodeSamples = (
  spec: OpenAPIObject,
  config: Config["samples"]
) => {
  const root = path.join(process.cwd(), config.dir);
  _.chain(_.entries(spec.paths))
    .flatMap(([api, methods]) =>
      _.map(_.entries(methods), ([method, operation]) => ({
        api,
        method,
        operation
      }))
    )
    .flatMap(descriptor =>
      _.map(_.entries(config.languages), ([lang, langConfig]) =>
        _.merge(descriptor, { lang, langConfig })
      )
    )
    .map(descriptor => {
      const filename = path.join(
        root,
        descriptor.lang,
        `${descriptor.operation.operationId}.${descriptor.method}.${descriptor.langConfig.extension}`
      );
      const source = fs.existsSync(filename)
        ? fs.readFileSync(filename).toString()
        : null;
      return _.merge(descriptor, { source });
    })
    .reject(descriptor => _.isEmpty(descriptor.source))
    .map(({ api, method, source, lang }) => {
      const samples = spec.paths[api][method]["x-code-samples"] || [];
      spec.paths[api][method]["x-code-samples"] = samples.concat([
        { lang, source }
      ]);
    })
    .value();
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
