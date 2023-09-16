// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// External library imports
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://github.com/Immutable-X/imx-contracts/blob/master/contracts/ERC20.sol";
import "https://github.com/maticnetwork/pos-portal/contracts/root/RootChainManager.sol";

contract PuckCity is ERC20, ERC1155, Ownable, Pausable, ReentrancyGuard, ChainlinkClient {
    // Constants
    uint256 private constant TEAM_COUNT = 32;
    uint256 private constant TOKENS_PER_TEAM = 1000;
    uint256 private constant PERCENT_MULTIPLIER = 1000; // For 0.5% transaction fee
    uint256 private constant MAX_SCORE = 100;
    uint256 private constant BASE = 10**8;
    uint256 private constant ETHER_IN_WEI = 1 ether;
    uint256 public unstakeFee = 50; // 5%
 uint256 public totalRevenueFromTransactionFees = 0; 
    uint256 public totalRevenueFromClaimFees = 0;


    // State variables
    bytes32 public jobId;
    uint256 public oraclePaymentAmount;

    uint256 public transactionFee = 5; // 0.5%
    uint256 public globalTreasury;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPlayoffTeams;
    uint256 public totalEliminatedTeams;
    uint256 public playoffDemandFactor;
    uint256 public eliminationDemandFactor;
    uint256 public totalTradingVolume = 0;  // Added for gas optimization

    mapping(uint256 => uint256) public reserves;
    mapping(uint256 => address) public teamTreasury;
    mapping(uint256 => mapping(uint256 => GameResult)) public gameResults;
    uint256 public lastResultUpdateBlock;
    uint256 public stakingBonus = 0;  // X, undetermined staking bonus
    bool public seasonIsActive = false;
    // Event declarations
    event PriceUpdated(uint256 newPrice);
    event RevenueUpdated(uint256 newTotalRevenue);

    AggregatorV3Interface private priceFeed;
    IERC20 private immutableX;
    RootChainManager private rootChainManager;

    // Chainlink specific variables
    address private oracle;
    uint256 private fee;

    struct GameResult {
        uint256 homeScore;
        uint256 awayScore;
        bool resultSubmitted;
        bool teamMadePlayoff;
        bool teamEliminated;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Caller is not the oracle");
        _;
    }

    // Constructor to initialize the contract with necessary parameters
    constructor(
        address[] memory _teamTreasuryAddresses,
        string memory _uri,
        address _priceFeedAddress,
        address _immutableXAddress,
        address _rootChainManagerAddress,
        bytes32 _jobId,
        uint256 _oraclePaymentAmount,
        address _oracle,
        bytes32 _chainlinkJobId,
        uint256 _chainlinkFee
    ) ERC20("Puck City", "PUCK") ERC1155(_uri) {
        require(_teamTreasuryAddresses.length == TEAM_COUNT, "Invalid team treasury addresses length");
        
        for (uint256 i = 0; i < TEAM_COUNT; i++) {
            teamTreasury[i] = _teamTreasuryAddresses[i];
        }
        
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        immutableX = IERC20(_immutableXAddress);
        rootChainManager = RootChainManager(_rootChainManagerAddress);
        jobId = _jobId;
        oraclePaymentAmount = _oraclePaymentAmount;

        // Chainlink setup
        setPublicChainlinkToken();
        oracle = _oracle;
        jobId = _chainlinkJobId;
        fee = _chainlinkFee;
    }

    // Function to withdraw from the global treasury
    function withdrawFromGlobalTreasury(uint256 _amount) public onlyOwner {
        require(_amount <= globalTreasury, "Insufficient balance in global treasury");
        globalTreasury -= _amount;
        (bool success,) = owner().call{value: _amount}("");
        require(success, "Withdrawal from global treasury failed");
    }

    // Get current price of the token
    function getCurrentPrice() public view returns (uint256) {
        uint256 reserveBalance = getReserveBalance(totalTradingVolume);
        return _calculatePrice(totalTradingVolume + 1, reserveBalance);
    }

    // Calculate the total trading volume
    function getTotalTradingVolume() public view returns (uint256) {
        return totalTradingVolume;
    }

    function getReserveBalance(uint256 tradingVolume) public view returns (uint256) {
        return globalTreasury - tradingVolume;
    }

    // Internal function to calculate the price
// ... [Previous Calculations]
    function _calculatePrice(uint256 tradingVolume, uint256 reserveBalance) internal view returns (uint256) {
        uint256 winRatio = (totalWins * BASE * BASE) / (totalWins + totalLosses);
        uint256 reserveRatio = (reserveBalance * BASE) / tradingVolume;
        uint256 demandFactor = 1 + playoffDemandFactor * totalPlayoffTeams / TEAM_COUNT - eliminationDemandFactor * totalEliminatedTeams / TEAM_COUNT;
        return (tradingVolume * winRatio * reserveRatio * demandFactor) / (BASE * BASE);
    }
// New calculations based on token dynamics
        uint256 TF = transactionFee;  // Transaction fee
        uint256 CF = unstakeFee;      // Claim fee (was called unstakeFee before)
        uint256 TR = totalRevenueFromTransactionFees;
        uint256 CR = totalRevenueFromClaimFees;
        uint256 Gm = 82;  // Games in a season
        uint256 Tm = Gm * TEAM_COUNT; // Assuming playoffs operate in seperate contract for simplification

        uint256 price = (tradingVolume / totalSupply()) * (totalWins / (totalWins + totalLosses)) * (reserveBalance / TEAM_COUNT)
                      * (1 + playoffDemandFactor * totalPlayoffTeams / TEAM_COUNT - eliminationDemandFactor * totalEliminatedTeams / TEAM_COUNT)
                      * (1 + TF * TR / totalSupply() + CF * CR / totalSupply()) * (1 + TF * Tm / Gm);

        return price;
    }
    // Function to purchase tokens
    function purchaseToken(uint256 _amount, uint256 _teamId) public payable whenNotPaused nonReentrant {
        require(_amount > 0 && _amount <= TOKENS_PER_TEAM, "Invalid amount");
        require(_teamId < TEAM_COUNT, "Invalid team ID");
        uint256 totalSupply = totalSupply();
        require(totalSupply < TEAM_COUNT * TOKENS_PER_TEAM, "All tokens have been minted");
        uint256 currentPrice = getCurrentPrice();
        uint256 totalPrice = currentPrice * _amount;
        require(msg.value >= totalPrice, "Insufficient payment");

        reserves[_teamId * TOKENS_PER_TEAM + (totalSupply % TOKENS_PER_TEAM)] += totalPrice;
        totalTradingVolume += totalPrice;  // Update the trading volume

        _mint(msg.sender, totalSupply + 1, _amount, "");
// Update total revenue from transaction fees
        totalRevenueFromTransactionFees += transactionFeeAmount;

        emit RevenueUpdated(totalRevenueFromTransactionFees + totalRevenueFromClaimFees);  // Emitting revenue update event
    }

        // Transfer 0.5% of the payment to the contract owner
        uint256 transactionFeeAmount = (totalPrice * transactionFee) / PERCENT_MULTIPLIER;
        (bool transferToOwner,) = payable(owner()).call{value: transactionFeeAmount}();
        require(transferToOwner, "Transfer to contract owner failed");

        // Transfer remaining payment to global treasury
        uint256 remainingAmount = totalPrice - transactionFeeAmount;
        globalTreasury += remainingAmount;

        // Refund any excess payment
        uint256 refundAmount = msg.value - totalPrice;
        if (refundAmount > 0) {
            (bool refund,) = payable(msg.sender).call{value: refundAmount}();
            require(refund, "Refund failed");
        }

        emit TokenPurchased(msg.sender, _amount, _teamId);
    }

    // Function to claim tokens
    function claimToken(uint256 _teamId) public nonReentrant {
        require(_teamId < TEAM_COUNT, "Invalid team ID");
        uint256 balance = balanceOf(msg.sender, _teamId);
        require(balance > 0, "No tokens to claim");

        uint256 value = reserves[_teamId * TOKENS_PER_TEAM + (balance - 1)];
        require(value > 0, "Token has no value");
// Update total revenue from claim fees
        totalRevenueFromClaimFees += feeAmount;

        emit RevenueUpdated(totalRevenueFromTransactionFees + totalRevenueFromClaimFees);  // Emitting revenue update event
    }

        // Deduct the unstake fee
        uint256 feeAmount = (value * unstakeFee) / PERCENT_MULTIPLIER;
        uint256 afterFeeValue = value - feeAmount;
        globalTreasury += feeAmount;

        reserves[_teamId * TOKENS_PER_TEAM + (balance - 1)] = 0;
        totalTradingVolume -= afterFeeValue;  // Update the trading volume

        bool transferFromSuccess = immutableX.transferFrom(address(this), msg.sender, afterFeeValue);
        require(transferFromSuccess, "Transfer from failed");

        _burn(msg.sender, _teamId, balance);
        emit TokenClaimed(msg.sender, balance, _teamId);
    }
    // Migrate ERC20 tokens to Polygon
    function migrateERC20ToPolygon(uint256 _amount) public onlyOwner {
        (bool success,) = address(rootChainManager).call{value: _amount}("");
        require(success, "Transfer to Polygon failed");
        rootChainManager.depositERC20(address(immutableX), msg.sender, _amount);
    }

    // Setter functions for contract parameters
    function setOraclePaymentAmount(uint256 _oraclePaymentAmount) public onlyOwner {
        oraclePaymentAmount = _oraclePaymentAmount;
    }

    function setJobId(bytes32 _jobId) public onlyOwner {
        jobId = _jobId;
    }

    function setTransactionFee(uint256 _transactionFee) public onlyOwner {
        transactionFee = _transactionFee;
    }

    function setStakingBonus(uint256 _stakingBonus) public onlyOwner {
        stakingBonus = _stakingBonus;
    }

    function setSeasonStatus(bool _isActive) public onlyOwner {
        seasonIsActive = _isActive;
    }

    function setPlayoffDemandFactor(uint256 _playoffDemandFactor) public onlyOwner {
        playoffDemandFactor = _playoffDemandFactor;
    }

    function setEliminationDemandFactor(uint256 _eliminationDemandFactor) public onlyOwner {
        eliminationDemandFactor = _eliminationDemandFactor;
    }

    // Function to set game results
    function setGameResult(uint256 _teamId, uint256 _gameId, uint256 _homeScore, uint256 _awayScore, bool _teamMadePlayoff, bool _teamEliminated) public onlyOracle {
        require(_teamId < TEAM_COUNT, "Invalid team ID");
        require(!gameResults[_teamId][_gameId].resultSubmitted, "Result already submitted");

        gameResults[_teamId][_gameId] = GameResult({
            homeScore: _homeScore,
            awayScore: _awayScore,
            resultSubmitted: true,
            teamMadePlayoff: _teamMadePlayoff,
            teamEliminated: _teamEliminated
        });

        if (_homeScore > _awayScore) {
            totalWins++;
        } else {
            totalLosses++;
        }

        if (_teamMadePlayoff) {
            totalPlayoffTeams++;
        }

        if (_teamEliminated) {
            totalEliminatedTeams++;
        }

        lastResultUpdateBlock = block.number;
        emit GameResultUpdated(_teamId, _gameId, _homeScore, _awayScore);
    }
// Update token price
        uint256 newPrice = _calculatePrice(totalTradingVolume, globalTreasury - totalTradingVolume);
        emit PriceUpdated(newPrice);  // Emitting price update event
    }
    // Chainlink function to request game results
    function requestGameResult(uint256 _teamId, uint256 _gameId) public onlyOwner returns (bytes32 requestId) {
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);

        // Set the URL and path for the sportsdata.io NHL API (this is just a placeholder and might need to be adjusted)
        request.add("get", "https://api.sportsdata.io/v4/nhl/scores/json/GamesByDate/2023-09-01");
        request.add("path", "Teams[0].Score");  // Adjust the path to get the desired data

        // Sends the request
        return sendChainlinkRequestTo(oracle, request, fee);
    }

    // Function to handle Chainlink responses
    function fulfill(bytes32 _requestId, uint256 _teamId, uint256 _gameId, uint256 _score) public recordChainlinkFulfillment(_requestId) {
        gameResults[_teamId][_gameId].homeScore = _score;
    }

    // Functions to control contract state
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Override function to add custom logic
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal whenNotPaused override {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}