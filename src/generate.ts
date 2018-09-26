import "reflect-metadata";
import {
  getMetadataArgsStorage,
  MetadataArgsStorage
} from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import { SchemaObject } from "openapi3-ts";
import {
  ParamMetadataArgs
} from "routing-controllers/metadata/args/ParamMetadataArgs";
import baseSchema from "./baseSchema";
import fs from "fs";
import path from "path";
import _ from "lodash";

interface GenerateOptions {
  inPath: string,
  outPath: string,
  packagePath: string,
  controllersExport: string,
  schemasPath: string
}

interface MetadataSchemaObject {
  obj: SchemaObject
}

const buildSchemas = (root): SchemaObject => {
  const schema = baseSchema;
  for (let file of fs.readdirSync(root)) {
    const filename = path.join(root, file);
    var stat = fs.lstatSync(filename);
    if (!stat.isDirectory() && filename.indexOf(".js") >= 0) {
      const apiSchema: SchemaObject = require(filename).default;
      Object.entries(apiSchema).forEach(([key, value]) => {
        apiSchema[value.id] = value;
        delete apiSchema[key];
      });
      Object.assign(schema, apiSchema);
    }
  }
  return schema;
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

export default ({
  inPath,
  outPath,
  packagePath,
  schemasPath,
  controllersExport
}: GenerateOptions) => {
  const packageJson: PackageJSON = require(packagePath);
  const routingControllerOptions = {
    controllers: require(inPath)[controllersExport]
  };
  const schemas = buildSchemas(schemasPath);
  const storage = getMetadataArgsStorage();
  copyReflectMetadata(storage, schemas);
  const spec = routingControllersToSpec(storage, routingControllerOptions, {
    components: { schemas },
    info: {
      title: packageJson.name,
      version: packageJson.version
    }
  });
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
};
