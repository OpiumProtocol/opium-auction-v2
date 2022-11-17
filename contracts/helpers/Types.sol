// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

library Types {
    struct StaticOrder {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
    }

    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
        bytes makerAssetData;
        bytes takerAssetData;
        bytes getMakerAmount;
        bytes getTakerAmount;
        bytes predicate;
        bytes permit;
        bytes interaction;
    }
}
