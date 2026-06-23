import { handleCommand } from "./commands.ts";

const cmd = process.argv[2];

handleCommand(cmd);