import { strict as assert } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(resolve(tmpdir(), "tack package with spaces "));
const installed = resolve(temporary, "installed");
const key = "fixture-credential-not-real";
const server = createServer((request,response) => {
  assert.equal(request.headers.authorization, `Bearer ${key}`);
  assert.equal(request.method,"GET");
  response.setHeader("Content-Type","application/json");
  response.setHeader("X-Request-Id","fixture-server-request");
  if(request.url === "/api/v1/me") response.end(JSON.stringify({scopes:["read"],boardIds:["TCK"]}));
  else if(request.url === "/api/v1/boards") response.end(JSON.stringify({boards:[{id:"TCK",name:"Fixture board"}]}));
  else {response.statusCode=404;response.end(JSON.stringify({error:{code:"not_found"}}));}
});
await new Promise((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const environment = {...process.env};
for(const name of ["TACK_API_KEY","TACK_BASE_URL"]) delete environment[name];
function run(entry,args,expected=0) {
  return new Promise((resolve,reject) => {
    const child=spawn(process.execPath,[entry,...args],{cwd:temporary,env:environment});
    let out="",err="";
    child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);
    child.on("error",reject);child.on("close",code=>{
      try{assert.equal(code,expected,err);assert.ok(!out.includes(key)&&!err.includes(key));resolve({out,err});}catch(error){reject(error);}
    });
  });
}
try {
  const manifest = JSON.parse(await readFile(resolve(root,"packages/tack-mcp/package.json"),"utf8"));
  const artifact = resolve(root,"artifacts",`${manifest.name.replace('@','').replace('/','-')}-${manifest.version}.tgz`);
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm",["install","--cache",resolve(temporary,"empty npm cache"),"--prefix",installed,"--offline","--ignore-scripts","--no-audit","--no-fund",artifact],{cwd:temporary,env:environment,stdio:"pipe"});
  const packageRoot=resolve(installed,"node_modules/@p2dev/tack-mcp");
  const entry=resolve(packageRoot,"dist/tack-mcp.cjs");
  assert.deepEqual((await readdir(resolve(installed,"node_modules"))).filter(n=>!n.startsWith('.')), ["@p2dev"]);
  const credential=resolve(temporary,"private.env");
  await writeFile(credential,`TACK_BASE_URL=${origin}\nTACK_API_KEY=${key}\n`,{mode:0o600});
  const diagnostic=await run(entry,["--env-file",credential,"--check"]);
  assert.equal(JSON.parse(diagnostic.out).ok,true);
  const failure=await run(entry,[],1);assert.equal(failure.out,"");
  const badArg=await run(entry,[key],1);assert.equal(badArg.out,"");
  const skill=resolve(temporary,"workspace/.agents/skills/tack");
  await run(entry,["--install-skill",skill]);
  assert.match(await readFile(resolve(skill,"SKILL.md"),"utf8"),/name: tack/);
  await run(entry,["--install-skill",skill],1);
  const transport=new StdioClientTransport({command:process.execPath,args:[entry,"--env-file",credential],cwd:temporary,env:environment,stderr:"pipe"});
  const client=new Client({name:"package-acceptance",version:"1.0.0"});
  try {
    await client.connect(transport);
    assert.match(client.getInstructions(),/stable ID/);
    assert.equal((await client.listTools()).tools.length,11);
    const me=await client.callTool({name:"tack_me",arguments:{}});
    assert.equal(me.isError,false);
    assert.equal(me.structuredContent._transport.serverRequestId,"fixture-server-request");
    assert.equal((await client.callTool({name:"tack_boards",arguments:{}})).isError,false);
  } finally {await client.close();}
  console.log("Offline package install, unrelated working directory, spaces in paths, 11 MCP tools, diagnostics, redaction, and non-overwriting skill installation passed.");
} finally { await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true}); }
