import { getMetadataArgsStorage } from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import { SchemaObject } from "openapi3-ts";
import baseSchema from "./baseSchema";
import fs from "fs";
import path from "path";

interface GenerateOptions {
  inPath: string,
  outPath: string,
  packagePath: string,
  controllersExport: string,
  schemasPath: string
}

const buildSchemas = (root): SchemaObject => {
  const schema = baseSchema;
  for (let file of fs.readdirSync(root)) {
    const filename = path.join(root, file);
    var stat = fs.lstatSync(filename);
    if (!stat.isDirectory() && filename.indexOf(".js") >= 0) {
      Object.assign(schema, require(filename).default);
    }
  }
  return schema;
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
  const storage = getMetadataArgsStorage();
  const spec = routingControllersToSpec(storage, routingControllerOptions, {
    components: { schemas: buildSchemas(schemasPath) },
    info: {
      title: packageJson.name,
      version: packageJson.version
    }
  });
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
};
