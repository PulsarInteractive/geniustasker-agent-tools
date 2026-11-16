import { main } from '../../src/cli.mjs';
process.exitCode = await main(['mcp'], {
  runtimeDirectory: process.argv[2],
  directory: process.argv[3],
  updateFetchImpl: () => {
    throw Error('MCP must not contact npm');
  },
});
