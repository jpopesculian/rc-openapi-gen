import program from "commander";
import path from "path";
import generate from "./generate";

const { version }: PackageJSON = require("../package.json");
const toAbsolutePath = pathname => path.join(process.cwd(), pathname);

program
  .version(version)
  .option(
    "-i, --in <dirname>",
    "root of the routing-controllers app",
    "dist/apis"
  )
  .option(
    "-o, --out <filename>",
    "file to output swagger JSON result",
    "docs/swagger.json"
  )
  .option(
    "-e, --export <name>",
    "name of export in routing-controllers root",
    "allControllers"
  )
  .option(
    "-s, --schema <dirname>",
    "directory of schema objects",
    "dist/schema"
  )
  .option("-p, --package <filename>", "path to package.json", "package.json")
  .parse(process.argv);

generate({
  inPath: toAbsolutePath(program.in),
  outPath: toAbsolutePath(program.out),
  packagePath: toAbsolutePath(program.package),
  schemasPath: toAbsolutePath(program.schema),
  controllersExport: program.export
});
