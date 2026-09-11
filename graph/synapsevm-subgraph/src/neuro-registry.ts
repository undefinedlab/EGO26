import {
  NeuroBlockRegistered,
  NeuroStackRegistered,
  NeuroBlockDeactivated,
  ValidationRecorded,
} from "../generated/NeuroRegistry/NeuroRegistry";
import { NeuroBlock, NeuroStack, Validation, ReceiptBatch } from "../generated/schema";
import { Bytes, BigInt } from "@graphprotocol/graph-ts";

function emptyMeta(): string {
  return "";
}

export function handleNeuroBlockRegistered(event: NeuroBlockRegistered): void {
  let id = event.params.blockRoot;
  let entity = NeuroBlock.load(id);
  if (entity == null) {
    entity = new NeuroBlock(id);
    entity.name = emptyMeta();
    entity.version = emptyMeta();
    entity.organism = emptyMeta();
    entity.sourceDataset = emptyMeta();
    entity.neuronCount = 0;
    entity.synapseCount = 0;
  }
  entity.blockRoot = event.params.blockRoot;
  entity.manifestURI = event.params.manifestURI;
  entity.publisher = event.params.publisher;
  entity.createdAt = event.block.timestamp;
  entity.active = true;
  entity.save();
}

export function handleNeuroStackRegistered(event: NeuroStackRegistered): void {
  let id = event.params.stackRoot;
  let entity = NeuroStack.load(id);
  if (entity == null) {
    entity = new NeuroStack(id);
    entity.name = emptyMeta();
    entity.version = emptyMeta();
  }
  entity.stackRoot = event.params.stackRoot;
  entity.manifestURI = event.params.manifestURI;
  entity.publisher = event.params.publisher;
  entity.createdAt = event.block.timestamp;
  entity.active = true;
  entity.save();
}

export function handleNeuroBlockDeactivated(event: NeuroBlockDeactivated): void {
  let entity = NeuroBlock.load(event.params.blockRoot);
  if (entity == null) return;
  entity.active = false;
  entity.save();
}

export function handleValidationRecorded(event: ValidationRecorded): void {
  let id = event.params.requestHash;
  let entity = new Validation(id);
  entity.requestHash = event.params.requestHash;
  entity.receiptRoot = event.params.receiptRoot;
  entity.blockRoot = event.params.blockRoot;
  entity.validator = event.transaction.from;
  entity.score = event.params.score;
  entity.tag = null;
  entity.evidenceURI = event.params.evidenceURI;
  entity.timestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();

  let batch = ReceiptBatch.load(event.params.receiptRoot);
  if (batch == null) {
    batch = new ReceiptBatch(event.params.receiptRoot);
    batch.deviceId = emptyMeta();
    batch.firstSequence = BigInt.fromI32(0);
    batch.lastSequence = BigInt.fromI32(0);
    batch.receiptRoot = event.params.receiptRoot;
  }
  batch.validation = id;
  batch.save();
}
