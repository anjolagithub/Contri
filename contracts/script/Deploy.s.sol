// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Contri} from "../src/Contri.sol";
import {MockAUSD} from "../src/MockAUSD.sol";

/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $DEPLOYER_KEY
/// Set TOKEN to an existing stablecoin to skip deploying Test AUSD.
contract Deploy is Script {
    function run() external {
        address token = vm.envOr("TOKEN", address(0));
        vm.startBroadcast();
        ERC2771Forwarder fwd = new ERC2771Forwarder("Contri");
        Contri contri = new Contri(address(fwd));
        if (token == address(0)) token = address(new MockAUSD());
        vm.stopBroadcast();
        console.log("NEXT_PUBLIC_FORWARDER=%s", address(fwd));
        console.log("NEXT_PUBLIC_CONTRI=%s", address(contri));
        console.log("NEXT_PUBLIC_TOKEN=%s", token);
    }
}
