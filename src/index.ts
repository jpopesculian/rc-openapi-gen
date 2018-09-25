import program from "commander";
import { version } from "../package.json";
import path from "path";
import generate from "./generate";

program
  .version(version)
  .option("-i, --in <path>", "root of the routing-controllers app", "dist/app")
  .option(
    "-o, --out <path>",
    "file to output swagger JSON result",
    "swagger.json"
  )
  .parse(process.argv);

generate({
  inPath: path.join(process.cwd(), program.in),
  outPath: path.join(process.cwd(), program.out)
});
