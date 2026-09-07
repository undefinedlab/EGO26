// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal NeuroBlock / NeuroStack registry + validation anchor (spec §16).
contract NeuroRegistry {
    struct BlockRecord {
        bytes32 blockRoot;
        string manifestURI;
        address publisher;
        uint64 createdAt;
        bool active;
    }

    struct ValidationRecord {
        bytes32 requestHash;
        bytes32 receiptRoot;
        bytes32 blockRoot;
        uint8 score;
        string evidenceURI;
        address validator;
        uint64 timestamp;
    }

    mapping(bytes32 => BlockRecord) public blocks;
    mapping(bytes32 => BlockRecord) public stacks;
    mapping(bytes32 => ValidationRecord) public validations;

    event NeuroBlockRegistered(bytes32 indexed blockRoot, address indexed publisher, string manifestURI);
    event NeuroStackRegistered(bytes32 indexed stackRoot, address indexed publisher, string manifestURI);
    event NeuroBlockDeactivated(bytes32 indexed blockRoot);
    event ValidationRecorded(
        bytes32 indexed requestHash,
        bytes32 indexed receiptRoot,
        bytes32 indexed blockRoot,
        uint8 score,
        string evidenceURI
    );

    function registerBlock(bytes32 blockRoot, string calldata manifestURI) external {
        require(blockRoot != bytes32(0), "bad root");
        require(!blocks[blockRoot].active, "exists");
        blocks[blockRoot] = BlockRecord({
            blockRoot: blockRoot,
            manifestURI: manifestURI,
            publisher: msg.sender,
            createdAt: uint64(block.timestamp),
            active: true
        });
        emit NeuroBlockRegistered(blockRoot, msg.sender, manifestURI);
    }

    function registerStack(bytes32 stackRoot, string calldata manifestURI) external {
        require(stackRoot != bytes32(0), "bad root");
        require(!stacks[stackRoot].active, "exists");
        stacks[stackRoot] = BlockRecord({
            blockRoot: stackRoot,
            manifestURI: manifestURI,
            publisher: msg.sender,
            createdAt: uint64(block.timestamp),
            active: true
        });
        emit NeuroStackRegistered(stackRoot, msg.sender, manifestURI);
    }

    function deactivateBlock(bytes32 blockRoot) external {
        BlockRecord storage rec = blocks[blockRoot];
        require(rec.active, "missing");
        require(rec.publisher == msg.sender, "not publisher");
        rec.active = false;
        emit NeuroBlockDeactivated(blockRoot);
    }

    function recordValidation(
        bytes32 requestHash,
        bytes32 receiptRoot,
        bytes32 blockRoot,
        uint8 score,
        string calldata evidenceURI
    ) external {
        validations[requestHash] = ValidationRecord({
            requestHash: requestHash,
            receiptRoot: receiptRoot,
            blockRoot: blockRoot,
            score: score,
            evidenceURI: evidenceURI,
            validator: msg.sender,
            timestamp: uint64(block.timestamp)
        });
        emit ValidationRecorded(requestHash, receiptRoot, blockRoot, score, evidenceURI);
    }
}
