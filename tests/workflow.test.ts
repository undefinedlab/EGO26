import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildStack,canonical,digest,template} from "../apps/neurolab-web/lib/composeCompiler.ts";
import {draftFingerprint,restoreBuild,composeReleaseHref} from "../apps/neurolab-web/lib/workflow.ts";
import type {LibraryItem} from "../apps/neurolab-web/lib/library.ts";
test("compiled workflow survives navigation and rejects stale graph or model bytes",async()=>{
 const draft={graph:template(),modules:{loomguard:readFileSync("blocks/loomguard/1.0.0/block.json","utf8")}};
 const pkg=await buildStack(draft.graph,async()=>draft.modules.loomguard);
 const record={pkg,fingerprint:draftFingerprint(draft),hash:await digest(canonical(pkg))};
 assert.deepEqual(await restoreBuild(JSON.stringify(record),draftFingerprint(draft)),record);
 assert.equal(draftFingerprint({...draft,positions:{x:500}} as typeof draft),record.fingerprint);
 await assert.rejects(()=>restoreBuild(JSON.stringify(record),draftFingerprint({...draft,graph:{...draft.graph,policy:"FAST"}})),/draft changed/);
 await assert.rejects(()=>restoreBuild(JSON.stringify(record),draftFingerprint({...draft,modules:{loomguard:draft.modules.loomguard+" "}})),/draft changed/);
 await assert.rejects(()=>restoreBuild(JSON.stringify({...record,hash:"wrong"}),record.fingerprint),/digest/);
});
test("Explore links preserve selected versions and do not offer unsupported blocks",()=>{
 const item={id:"local-lab/reflex",version:"0.2.0",kind:"NeuroBlock",modelDigest:"sha256:abc",actualInputs:["depth_front","depth_left","depth_right","loom"],files:[]} as unknown as LibraryItem;
 assert.equal(composeReleaseHref(item),"/compose?block=local-lab%2Freflex&version=0.2.0");
 assert.equal(composeReleaseHref({...item,actualInputs:["yaw"]}),null);
 assert.equal(composeReleaseHref({...item,kind:"NeuroStack",files:[{name:"stack.synapse",bytes:1,digest:"x"}]}),"/compose?repository=local-lab%2Freflex&version=0.2.0");
});
