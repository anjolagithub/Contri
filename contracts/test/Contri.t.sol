// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Contri} from "../src/Contri.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ContriTest is Test {
    Contri contri;
    MockAUSD usd;
    ERC2771Forwarder fwd;

    uint128 constant C = 100e6; // contribution: $100
    uint128 constant D = 100e6; // deposit: one contribution
    uint64 constant P = 1 weeks;

    address[] people;
    uint256[] keys;

    function setUp() public {
        fwd = new ERC2771Forwarder("Contri");
        contri = new Contri(address(fwd));
        usd = new MockAUSD();
        for (uint256 i; i < 6; ++i) {
            (address a, uint256 k) = makeAddrAndKey(string(abi.encodePacked("member", vm.toString(i))));
            people.push(a);
            keys.push(k);
            usd.faucet(a, 1_000e6);
            vm.prank(a);
            usd.approve(address(contri), type(uint256).max);
        }
    }

    // ------------------------------------------------------------ helpers

    function _circle(uint8 size, uint128 deposit) internal returns (uint256 id) {
        vm.prank(people[0]);
        id = contri.create(IERC20(address(usd)), "Friday ajo", C, deposit, P, size);
        for (uint256 i = 1; i < size; ++i) {
            vm.prank(people[i]);
            contri.join(id);
        }
    }

    function _payAll(uint256 id, uint8 size) internal {
        for (uint256 i; i < size; ++i) {
            (, Contri.MemberView[] memory ms) = contri.getCircle(id);
            if (ms[i].removed || ms[i].paidThisRound) continue;
            vm.prank(people[i]);
            contri.contribute(id);
        }
    }

    function _state(uint256 id) internal view returns (Contri.Circle memory c) {
        (c,) = contri.getCircle(id);
    }

    // ------------------------------------------------------------ setup and joining

    function test_CreateJoinStarts() public {
        uint256 id = _circle(4, D);
        Contri.Circle memory c = _state(id);
        assertEq(uint8(c.status), uint8(Contri.Status.Active));
        assertEq(c.deadline, block.timestamp + P);
        assertEq(c.activeCount, 4);
        assertEq(usd.balanceOf(address(contri)), 4 * D);
        assertEq(contri.circlesOf(people[2]).length, 1);
    }

    function test_RevertsOnBadParams() public {
        vm.startPrank(people[0]);
        vm.expectRevert(Contri.InvalidParams.selector);
        contri.create(IERC20(address(usd)), "x", 0, D, P, 4);
        vm.expectRevert(Contri.InvalidParams.selector);
        contri.create(IERC20(address(usd)), "x", C, D, P, 1);
        vm.expectRevert(Contri.InvalidParams.selector);
        contri.create(IERC20(address(usd)), "x", C, D, 10, 4);
        vm.expectRevert(Contri.InvalidParams.selector);
        contri.create(IERC20(address(usd)), "", C, D, P, 4);
        vm.stopPrank();
    }

    function test_CannotJoinTwiceOrAfterFull() public {
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Two", C, D, P, 2);
        vm.prank(people[0]);
        vm.expectRevert(Contri.AlreadyMember.selector);
        contri.join(id);
        vm.prank(people[1]);
        contri.join(id);
        vm.prank(people[2]);
        vm.expectRevert(Contri.WrongStatus.selector);
        contri.join(id);
    }

    function test_CannotJoinMissingCircle() public {
        vm.prank(people[1]);
        vm.expectRevert(Contri.WrongStatus.selector);
        contri.join(42);
    }

    function test_LeaveBeforeStartKeepsOrder() public {
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Leave", C, D, P, 4);
        vm.prank(people[1]);
        contri.join(id);
        vm.prank(people[2]);
        contri.join(id);
        uint256 before = usd.balanceOf(people[1]);
        vm.prank(people[1]);
        contri.leave(id);
        assertEq(usd.balanceOf(people[1]), before + D);
        address[] memory ms = contri.membersOf(id);
        assertEq(ms.length, 2);
        assertEq(ms[0], people[0]);
        assertEq(ms[1], people[2]);
    }

    function test_CancelRefundsDeposits() public {
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Cancel", C, D, P, 4);
        vm.prank(people[1]);
        contri.join(id);
        vm.prank(people[1]);
        vm.expectRevert(Contri.NotCreator.selector);
        contri.cancel(id);
        vm.prank(people[0]);
        contri.cancel(id);
        uint256 before = usd.balanceOf(people[1]);
        vm.prank(people[1]);
        contri.withdrawDeposit(id);
        assertEq(usd.balanceOf(people[1]), before + D);
        vm.prank(people[0]);
        contri.withdrawDeposit(id);
        assertEq(usd.balanceOf(address(contri)), 0);
    }

    // ------------------------------------------------------------ the happy path

    function test_PotGoesOutTheMomentEveryonePays() public {
        uint256 id = _circle(4, D);
        uint256 before = usd.balanceOf(people[0]);
        _payAll(id, 4);
        // member #1 paid 100 and received 400
        assertEq(usd.balanceOf(people[0]), before - C + 4 * C);
        Contri.Circle memory c = _state(id);
        assertEq(c.round, 1);
        assertEq(c.pot, 0);
        assertEq(c.deadline, block.timestamp + 2 * P, "schedule kept when paid early");
    }

    function test_FullCircleEveryoneEvens() public {
        uint256 id = _circle(5, D);
        uint256[] memory start = new uint256[](5);
        for (uint256 i; i < 5; ++i) start[i] = usd.balanceOf(people[i]);
        for (uint256 r; r < 5; ++r) _payAll(id, 5);
        assertEq(uint8(_state(id).status), uint8(Contri.Status.Done));
        for (uint256 i; i < 5; ++i) {
            vm.prank(people[i]);
            contri.withdrawDeposit(id);
            assertEq(usd.balanceOf(people[i]), start[i] + D, "paid 5x100, got 500 and the deposit back");
        }
        assertEq(usd.balanceOf(address(contri)), 0);
    }

    function test_CannotPayTwice() public {
        uint256 id = _circle(3, D);
        vm.prank(people[1]);
        contri.contribute(id);
        vm.prank(people[1]);
        vm.expectRevert(Contri.AlreadyPaid.selector);
        contri.contribute(id);
    }

    function test_OutsiderCannotPay() public {
        uint256 id = _circle(3, D);
        vm.prank(people[5]);
        vm.expectRevert(Contri.NotMember.selector);
        contri.contribute(id);
    }

    // ------------------------------------------------------------ late and missing payments

    function test_CannotSettleEarly() public {
        uint256 id = _circle(3, D);
        vm.expectRevert(Contri.TooEarly.selector);
        contri.settleRound(id);
    }

    function test_DepositCoversALatePayer() public {
        uint256 id = _circle(4, D);
        vm.prank(people[0]);
        contri.contribute(id);
        vm.prank(people[1]);
        contri.contribute(id);
        vm.prank(people[2]);
        contri.contribute(id);
        // people[3] doesn't pay
        uint256 before = usd.balanceOf(people[0]);
        vm.warp(block.timestamp + P + 1);
        contri.settleRound(id); // anyone can settle
        assertEq(usd.balanceOf(people[0]), before + 4 * C, "recipient still gets the full pot");
        (address a, uint128 dep, uint8 strikes,,) = _member(id, 3);
        assertEq(a, people[3]);
        assertEq(dep, 0);
        assertEq(strikes, 1);
    }

    function test_DefaulterWithNoDepositIsRemovedAndLosesTurn() public {
        uint256 id = _circle(4, D);
        // round 0: people[3] misses, deposit covers it
        _payExcept(id, 4, 3);
        vm.warp(block.timestamp + P + 1);
        contri.settleRound(id);
        // round 1: people[3] misses again, no deposit left -> removed
        _payExcept(id, 4, 3);
        vm.warp(_state(id).deadline + 1);
        uint256 before = usd.balanceOf(people[1]);
        contri.settleRound(id);
        assertEq(usd.balanceOf(people[1]), before + 3 * C);
        (,,, bool removed,) = _member(id, 3);
        assertTrue(removed);
        // round 2 pays people[2]; round 3 (people[3]'s turn) is skipped -> circle ends
        _payAll(id, 4);
        assertEq(uint8(_state(id).status), uint8(Contri.Status.Done));
        _withdrawAll(id, 4);
        assertEq(usd.balanceOf(address(contri)), 0);
    }

    function test_RecipientWhoDefaultsOnOwnRoundIsRefundedToPayers() public {
        uint256 id = _circle(3, 0); // no deposits
        // round 0: people[0] receives normally
        _payAll(id, 3);
        // round 1 is people[1]'s turn, but people[1] does not pay
        uint256 b0 = usd.balanceOf(people[0]);
        uint256 b2 = usd.balanceOf(people[2]);
        _payExcept(id, 3, 1);
        vm.warp(_state(id).deadline + 1);
        contri.settleRound(id);
        assertEq(usd.balanceOf(people[0]), b0, "payer refunded in full");
        assertEq(usd.balanceOf(people[2]), b2, "payer refunded in full");
        assertEq(uint8(_state(id).round), 2);
        _payAll(id, 3);
        assertEq(uint8(_state(id).status), uint8(Contri.Status.Done));
        assertEq(usd.balanceOf(address(contri)), 0);
    }

    function test_EveryoneGhostsFundsNotStuck() public {
        uint256 id = _circle(3, 50e6); // deposit smaller than contribution
        vm.warp(block.timestamp + P + 1);
        contri.settleRound(id);
        assertEq(uint8(_state(id).status), uint8(Contri.Status.Done));
        vm.prank(people[0]);
        contri.withdrawDeposit(id);
        assertEq(usd.balanceOf(address(contri)), 0);
    }

    // ------------------------------------------------------------ gasless: forwarder + permit

    function test_RelayedJoinWithPermit_NoGasNoApprove() public {
        (address fresh, uint256 pk) = makeAddrAndKey("fresh");
        usd.faucet(fresh, 500e6);
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Gasless", C, D, P, 3);

        (uint8 v, bytes32 r, bytes32 s) = _permitSig(pk, fresh, D, block.timestamp + 1 hours);
        bytes memory data =
            abi.encodeCall(Contri.joinWithPermit, (id, uint256(D), block.timestamp + 1 hours, v, r, s));
        ERC2771Forwarder.ForwardRequestData memory req = _request(pk, fresh, data);

        address relayer = makeAddr("relayer");
        vm.prank(relayer);
        fwd.execute(req);

        assertEq(contri.membersOf(id)[1], fresh, "joined as the signer, not the relayer");
        assertEq(usd.balanceOf(fresh), 500e6 - D);
        assertEq(fresh.balance, 0, "signer never held gas");
    }

    function test_RelayedContributeWithPermit() public {
        (address fresh, uint256 pk) = makeAddrAndKey("fresh2");
        usd.faucet(fresh, 500e6);
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Gasless", C, 0, P, 2);
        _relay(pk, fresh, abi.encodeCall(Contri.join, (id)));
        vm.prank(people[0]);
        contri.contribute(id);

        (uint8 v, bytes32 r, bytes32 s) = _permitSig(pk, fresh, C, block.timestamp + 1 hours);
        uint256 before = usd.balanceOf(people[0]);
        _relay(pk, fresh, abi.encodeCall(Contri.contributeWithPermit, (id, uint256(C), block.timestamp + 1 hours, v, r, s)));
        assertEq(usd.balanceOf(people[0]), before + 2 * C, "pot paid out on the relayed payment");
    }

    function test_FrontRunPermitDoesNotBlock() public {
        (address fresh, uint256 pk) = makeAddrAndKey("fresh3");
        usd.faucet(fresh, 500e6);
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Gasless", C, D, P, 3);
        uint256 dl = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permitSig(pk, fresh, D, dl);
        usd.permit(fresh, address(contri), D, dl, v, r, s); // griefer submits it first
        _relay(pk, fresh, abi.encodeCall(Contri.joinWithPermit, (id, uint256(D), dl, v, r, s)));
        assertEq(contri.membersOf(id)[1], fresh);
    }

    function test_ForgedSenderRejected() public {
        (address fresh, uint256 pk) = makeAddrAndKey("fresh4");
        vm.prank(people[0]);
        uint256 id = contri.create(IERC20(address(usd)), "Gasless", C, 0, P, 3);
        ERC2771Forwarder.ForwardRequestData memory req = _request(pk, fresh, abi.encodeCall(Contri.join, (id)));
        req.from = people[1]; // claim to be someone else
        vm.expectRevert();
        fwd.execute(req);
    }

    // ------------------------------------------------------------ fuzz: money is conserved

    /// For any size, deposit, and pattern of who pays each round, every dollar that went in
    /// comes out to a member and the contract ends empty.
    function testFuzz_Conservation(uint8 sizeSeed, uint128 depositSeed, uint256 pattern) public {
        uint8 size = uint8(bound(sizeSeed, 2, 6));
        uint128 deposit = uint128(bound(depositSeed, 0, 2 * C));
        uint256 total;
        for (uint256 i; i < size; ++i) total += usd.balanceOf(people[i]);

        uint256 id = _circle(size, deposit);
        uint256 guard;
        while (_state(id).status == Contri.Status.Active && guard++ < 20) {
            (, Contri.MemberView[] memory ms) = contri.getCircle(id);
            for (uint256 i; i < size; ++i) {
                bool pays = (pattern >> ((guard * 8 + i) % 256)) & 1 == 1 || (pattern % 3 == 0);
                if (pays && !ms[i].removed && !ms[i].paidThisRound) {
                    vm.prank(people[i]);
                    contri.contribute(id);
                    if (_state(id).status != Contri.Status.Active) break;
                    (, ms) = contri.getCircle(id);
                }
            }
            if (_state(id).status == Contri.Status.Active) {
                vm.warp(_state(id).deadline + 1);
                contri.settleRound(id);
            }
        }
        assertEq(uint8(_state(id).status), uint8(Contri.Status.Done), "circle always finishes");
        _withdrawAll(id, size);
        uint256 after_;
        for (uint256 i; i < size; ++i) after_ += usd.balanceOf(people[i]);
        assertEq(after_, total, "no money created or lost");
        assertEq(usd.balanceOf(address(contri)), 0, "contract ends empty");
    }

    // ------------------------------------------------------------ more helpers

    function _payExcept(uint256 id, uint8 size, uint256 skip) internal {
        for (uint256 i; i < size; ++i) {
            if (i == skip) continue;
            (, Contri.MemberView[] memory ms) = contri.getCircle(id);
            if (ms[i].removed || ms[i].paidThisRound) continue;
            vm.prank(people[i]);
            contri.contribute(id);
        }
    }

    function _withdrawAll(uint256 id, uint8 size) internal {
        for (uint256 i; i < size; ++i) {
            (, uint128 dep,,,) = _member(id, i);
            if (dep == 0) continue;
            vm.prank(people[i]);
            contri.withdrawDeposit(id);
        }
    }

    function _member(uint256 id, uint256 i)
        internal
        view
        returns (address a, uint128 dep, uint8 strikes, bool removed, bool received)
    {
        (, Contri.MemberView[] memory ms) = contri.getCircle(id);
        Contri.MemberView memory m = ms[i];
        return (m.account, m.deposit, m.strikes, m.removed, m.received);
    }

    function _permitSig(uint256 pk, address owner, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8, bytes32, bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(contri),
                value,
                usd.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash));
        return vm.sign(pk, digest);
    }

    function _request(uint256 pk, address from, bytes memory data)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        uint48 deadline = uint48(block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
                ),
                from,
                address(contri),
                uint256(0),
                uint256(500_000),
                fwd.nonces(from),
                deadline,
                keccak256(data)
            )
        );
        (, string memory name, string memory version, uint256 chainId, address verifying,,) = fwd.eip712Domain();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifying
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: address(contri),
            value: 0,
            gas: 500_000,
            deadline: deadline,
            data: data,
            signature: abi.encodePacked(r, s, v)
        });
    }

    function _relay(uint256 pk, address from, bytes memory data) internal {
        ERC2771Forwarder.ForwardRequestData memory req = _request(pk, from, data);
        vm.prank(makeAddr("relayer"));
        fwd.execute(req);
    }
}
