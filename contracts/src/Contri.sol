// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Contri: a rotating savings circle (ajo, esusu, chama, tontine) with no collector.
/// @notice Members put in the same amount every round; each round one member takes the whole pot,
///         in the order they joined. The contract is the collector: it holds the money for seconds,
///         not weeks. Each member also locks a deposit that covers a missed payment, so one late
///         member never stops the pot from going out.
/// @dev Gasless by design: every user action accepts calls through a trusted ERC-2771 forwarder
///      (the app's relayer pays gas) and has a *WithPermit variant so token approval is a signature.
contract Contri is ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Open, // waiting for members
        Active, // rounds running
        Done, // every round finished; deposits can be withdrawn
        Cancelled // never started; deposits can be withdrawn
    }

    struct Circle {
        IERC20 token;
        address creator;
        uint128 contribution; // per member per round, token units
        uint128 deposit; // locked by each member on join
        uint64 period; // seconds per round
        uint64 deadline; // current round closes at this time
        uint8 size; // members (and rounds)
        uint8 round; // current round, 0-indexed; recipient = members[round]
        uint8 activeCount; // members not removed
        uint8 paidCount; // payments counted toward the current round
        Status status;
        uint256 pot; // collected for the current round
        string name;
    }

    struct Member {
        uint128 deposit; // what is left of the deposit
        uint8 strikes; // rounds covered by the deposit
        bool removed; // ran out of deposit while owing
        bool received; // has taken their pot
        bool exists;
    }

    uint8 public constant MAX_SIZE = 30;
    uint64 public constant MIN_PERIOD = 60; // one minute, for demo circles

    uint256 public circleCount;
    mapping(uint256 => Circle) internal _circles;
    mapping(uint256 => address[]) internal _members;
    mapping(uint256 => mapping(address => Member)) public memberOf;
    /// @dev paid[circle][round][member]
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public paid;
    mapping(address => uint256[]) internal _circlesOf;

    event CircleCreated(uint256 indexed id, address indexed creator, address token, string name, uint256 contribution, uint256 deposit, uint64 period, uint8 size);
    event Joined(uint256 indexed id, address indexed member, uint8 position);
    event Left(uint256 indexed id, address indexed member);
    event Started(uint256 indexed id, uint64 firstDeadline);
    event Contributed(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event CoveredByDeposit(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event MemberRemoved(uint256 indexed id, uint8 indexed round, address indexed member, uint256 forfeited);
    event PaidOut(uint256 indexed id, uint8 indexed round, address indexed recipient, uint256 amount);
    event RoundRefunded(uint256 indexed id, uint8 indexed round, uint256 amount);
    event RoundSkipped(uint256 indexed id, uint8 indexed round, address indexed recipient);
    event Finished(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event DepositWithdrawn(uint256 indexed id, address indexed member, uint256 amount);

    error InvalidParams();
    error WrongStatus();
    error NotMember();
    error AlreadyMember();
    error AlreadyPaid();
    error NotCreator();
    error TooEarly();
    error NothingToWithdraw();

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    // ---------------------------------------------------------------- create / join / leave

    /// @notice Start a circle. The creator joins as member #1 (first to collect).
    function create(IERC20 token, string calldata name, uint128 contribution, uint128 deposit, uint64 period, uint8 size)
        external
        nonReentrant
        returns (uint256 id)
    {
        id = _create(token, name, contribution, deposit, period, size);
        _join(id, _msgSender());
    }

    function createWithPermit(
        IERC20 token,
        string calldata name,
        uint128 contribution,
        uint128 deposit,
        uint64 period,
        uint8 size,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant returns (uint256 id) {
        _permit(address(token), permitValue, permitDeadline, v, r, s);
        id = _create(token, name, contribution, deposit, period, size);
        _join(id, _msgSender());
    }

    function join(uint256 id) external nonReentrant {
        _join(id, _msgSender());
    }

    function joinWithPermit(uint256 id, uint256 permitValue, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        _permit(address(_circles[id].token), permitValue, permitDeadline, v, r, s);
        _join(id, _msgSender());
    }

    /// @notice Leave before the circle starts; the deposit comes back and later members move up.
    function leave(uint256 id) external nonReentrant {
        Circle storage c = _circles[id];
        if (c.status != Status.Open) revert WrongStatus();
        address who = _msgSender();
        Member storage m = memberOf[id][who];
        if (!m.exists) revert NotMember();

        uint256 refund = m.deposit;
        address[] storage list = _members[id];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) {
            if (list[i] == who) {
                for (uint256 j = i; j + 1 < n; ++j) list[j] = list[j + 1];
                list.pop();
                break;
            }
        }
        delete memberOf[id][who];
        c.activeCount -= 1;
        emit Left(id, who);
        if (refund > 0) c.token.safeTransfer(who, refund);
    }

    /// @notice The creator can call off a circle that never filled. Members then withdraw deposits.
    function cancel(uint256 id) external {
        Circle storage c = _circles[id];
        if (_msgSender() != c.creator) revert NotCreator();
        if (c.status != Status.Open) revert WrongStatus();
        c.status = Status.Cancelled;
        emit Cancelled(id);
    }

    // ---------------------------------------------------------------- rounds

    /// @notice Pay this round. When everyone has paid, the pot goes to this round's member at once.
    function contribute(uint256 id) external nonReentrant {
        _contribute(id, _msgSender());
    }

    function contributeWithPermit(uint256 id, uint256 permitValue, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        _permit(address(_circles[id].token), permitValue, permitDeadline, v, r, s);
        _contribute(id, _msgSender());
    }

    /// @notice After the deadline anyone can close the round. Each member who has not paid is
    ///         covered from their deposit (a strike). A member whose deposit can't cover it is
    ///         removed and loses their turn. Then the pot goes out.
    function settleRound(uint256 id) external nonReentrant {
        Circle storage c = _circles[id];
        if (c.status != Status.Active) revert WrongStatus();
        if (block.timestamp <= c.deadline) revert TooEarly();

        uint8 round = c.round;
        address[] storage list = _members[id];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) {
            address who = list[i];
            Member storage m = memberOf[id][who];
            if (m.removed || paid[id][round][who]) continue;

            if (m.deposit >= c.contribution) {
                m.deposit -= c.contribution;
                m.strikes += 1;
                paid[id][round][who] = true;
                c.pot += c.contribution;
                c.paidCount += 1;
                emit CoveredByDeposit(id, round, who, c.contribution);
            } else {
                uint256 forfeited = m.deposit;
                m.deposit = 0;
                m.removed = true;
                c.activeCount -= 1;
                c.pot += forfeited;
                emit MemberRemoved(id, round, who, forfeited);
            }
        }
        _payOut(id);
    }

    /// @notice Take back what is left of your deposit once the circle is finished or cancelled.
    function withdrawDeposit(uint256 id) external nonReentrant {
        Circle storage c = _circles[id];
        if (c.status != Status.Done && c.status != Status.Cancelled) revert WrongStatus();
        address who = _msgSender();
        Member storage m = memberOf[id][who];
        uint256 amount = m.deposit;
        if (amount == 0) revert NothingToWithdraw();
        m.deposit = 0;
        emit DepositWithdrawn(id, who, amount);
        c.token.safeTransfer(who, amount);
    }

    // ---------------------------------------------------------------- views

    struct MemberView {
        address account;
        uint128 deposit;
        uint8 strikes;
        bool removed;
        bool received;
        bool paidThisRound;
    }

    function getCircle(uint256 id) external view returns (Circle memory circle, MemberView[] memory members) {
        circle = _circles[id];
        address[] storage list = _members[id];
        members = new MemberView[](list.length);
        for (uint256 i; i < list.length; ++i) {
            Member storage m = memberOf[id][list[i]];
            members[i] = MemberView(list[i], m.deposit, m.strikes, m.removed, m.received, paid[id][circle.round][list[i]]);
        }
    }

    function circlesOf(address account) external view returns (uint256[] memory) {
        return _circlesOf[account];
    }

    function membersOf(uint256 id) external view returns (address[] memory) {
        return _members[id];
    }

    // ---------------------------------------------------------------- internals

    function _create(IERC20 token, string calldata name, uint128 contribution, uint128 deposit, uint64 period, uint8 size)
        internal
        returns (uint256 id)
    {
        if (address(token) == address(0) || contribution == 0 || size < 2 || size > MAX_SIZE || period < MIN_PERIOD) {
            revert InvalidParams();
        }
        if (bytes(name).length == 0 || bytes(name).length > 48) revert InvalidParams();
        id = ++circleCount;
        Circle storage c = _circles[id];
        c.token = token;
        c.creator = _msgSender();
        c.contribution = contribution;
        c.deposit = deposit;
        c.period = period;
        c.size = size;
        c.name = name;
        emit CircleCreated(id, c.creator, address(token), name, contribution, deposit, period, size);
    }

    function _join(uint256 id, address who) internal {
        Circle storage c = _circles[id];
        if (c.status != Status.Open || id == 0 || id > circleCount) revert WrongStatus();
        Member storage m = memberOf[id][who];
        if (m.exists) revert AlreadyMember();

        m.exists = true;
        m.deposit = c.deposit;
        _members[id].push(who);
        _circlesOf[who].push(id);
        c.activeCount += 1;
        emit Joined(id, who, uint8(_members[id].length));

        if (c.deposit > 0) c.token.safeTransferFrom(who, address(this), c.deposit);

        if (_members[id].length == c.size) {
            c.status = Status.Active;
            c.deadline = uint64(block.timestamp) + c.period;
            emit Started(id, c.deadline);
        }
    }

    function _contribute(uint256 id, address who) internal {
        Circle storage c = _circles[id];
        if (c.status != Status.Active) revert WrongStatus();
        Member storage m = memberOf[id][who];
        if (!m.exists || m.removed) revert NotMember();
        uint8 round = c.round;
        if (paid[id][round][who]) revert AlreadyPaid();

        paid[id][round][who] = true;
        c.pot += c.contribution;
        c.paidCount += 1;
        emit Contributed(id, round, who, c.contribution);
        c.token.safeTransferFrom(who, address(this), c.contribution);

        if (c.paidCount == c.activeCount) _payOut(id);
    }

    /// @dev Sends the pot to this round's member (or back to the payers if that member was
    ///      removed), then opens the next round whose member is still in.
    function _payOut(uint256 id) internal {
        Circle storage c = _circles[id];
        uint8 round = c.round;
        address recipient = _members[id][round];
        Member storage r = memberOf[id][recipient];
        uint256 amount = c.pot;
        c.pot = 0;
        c.paidCount = 0;

        if (!r.removed) {
            r.received = true;
            emit PaidOut(id, round, recipient, amount);
            if (amount > 0) c.token.safeTransfer(recipient, amount);
        } else if (amount > 0) {
            // The member whose turn it was has been removed: hand each payer's money back.
            // Anything the removed member forfeited this round is shared out with it.
            address[] storage list = _members[id];
            uint256 payers;
            for (uint256 i; i < list.length; ++i) {
                if (paid[id][round][list[i]] && !memberOf[id][list[i]].removed) payers++;
            }
            if (payers == 0) {
                // Nobody left to refund: keep it with the next recipient's pot.
                c.pot = amount;
            } else {
                uint256 share = amount / payers;
                uint256 dust = amount - share * payers;
                emit RoundRefunded(id, round, amount);
                bool first = true;
                for (uint256 i; i < list.length; ++i) {
                    address who = list[i];
                    if (paid[id][round][who] && !memberOf[id][who].removed) {
                        uint256 give = share;
                        if (first) {
                            give += dust;
                            first = false;
                        }
                        c.token.safeTransfer(who, give);
                    }
                }
            }
        }

        uint64 base = c.deadline > block.timestamp ? c.deadline : uint64(block.timestamp);
        uint8 next = round + 1;
        while (next < c.size && memberOf[id][_members[id][next]].removed) {
            emit RoundSkipped(id, next, _members[id][next]);
            next++;
        }
        if (next >= c.size || c.activeCount == 0) {
            c.status = Status.Done;
            // Money with no one left to receive it (only possible after removals) is credited
            // to the remaining members' deposits, so it can be withdrawn and is never stuck.
            if (c.pot > 0) _shareLeftover(id);
            emit Finished(id);
        } else {
            c.round = next;
            c.deadline = base + c.period;
        }
    }

    function _shareLeftover(uint256 id) internal {
        Circle storage c = _circles[id];
        uint256 amount = c.pot;
        c.pot = 0;
        address[] storage list = _members[id];
        uint256 active;
        for (uint256 i; i < list.length; ++i) if (!memberOf[id][list[i]].removed) active++;
        if (active == 0) {
            // Everyone was removed: the leftover is forfeited deposits. Credit it to the creator's deposit
            // record so it is withdrawable rather than stuck.
            memberOf[id][c.creator].deposit += uint128(amount);
            return;
        }
        uint256 share = amount / active;
        uint256 dust = amount - share * active;
        bool first = true;
        for (uint256 i; i < list.length; ++i) {
            Member storage m = memberOf[id][list[i]];
            if (m.removed) continue;
            uint256 give = share;
            if (first) {
                give += dust;
                first = false;
            }
            m.deposit += uint128(give);
        }
    }

    function _permit(address token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) internal {
        // A front-run permit (someone submitting the same signature first) must not block the call.
        try IERC20Permit(token).permit(_msgSender(), address(this), value, deadline, v, r, s) {} catch {}
    }
}
