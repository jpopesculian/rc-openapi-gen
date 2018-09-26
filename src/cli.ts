import program from "commander";
import path from "path";
import generate from "./generate";
import { PackageJSON } from "./interfaces";

const { version }: PackageJSON = require("../package.json");

program
  .version(version)
  .option(
    "-c, --config <filename>",
    "path to rc-openapi-gen config",
    "docs/rc-openapi-gen.conf.js"
  )
  .parse(process.argv);

generate(require(path.join(process.cwd(), program.config)));
