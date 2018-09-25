import { getMetadataArgsStorage } from "routing-controllers";
import { routingControllersToSpec } from "routing-controllers-openapi";
import fs from "fs";

interface GenerateOptions {
  inPath: string,
  outPath: string
}
export default ({ inPath, outPath }: GenerateOptions) => {
  require(inPath);
  fs.writeFileSync(
    outPath,
    JSON.stringify(routingControllersToSpec(getMetadataArgsStorage()), null, 2)
  );
};
