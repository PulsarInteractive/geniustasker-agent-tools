#!/usr/bin/env node
import { main } from '../src/cli.mjs';
const cancellation = new AbortController();
process.once('SIGINT', () => cancellation.abort());
process.once('SIGTERM', () => cancellation.abort());
process.exitCode = await main(process.argv.slice(2), { signal: cancellation.signal });
