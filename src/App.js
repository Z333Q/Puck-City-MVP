// Constants for contract addresses
// TODO: Replace with your actual contract addresses
const CONTRACT_ADDRESS = "<your-contract-address>";
const PUCK_TOKEN_ADDRESS = "<your-puck-token-address>";
const baseURI = "https://puck.city/assets/";

// Team tokens information
const CITY_TOKENS = [
  { name: "Anaheim", image: "anaheim.png" },
  { name: "Arizona", image: "arizona.png" },
  { name: "Boston", image: "boston.png" },
  { name: "Buffalo", image: "buffalo.png" },
  { name: "Calgary", image: "calgary.png" },
  { name: "Carolina", image: "carolina.png" },
  { name: "Chicago", image: "chicago.png" },
  { name: "Colorado", image: "colorado.png" },
  { name: "Columbus", image: "columbus.png" },
  { name: "Dallas", image: "dallas.png" },
  { name: "Detroit", image: "detroit.png" },
  { name: "Edmonton", image: "edmonton.png" },
  { name: "Florida", image: "florida.png" },
  { name: "Los Angeles", image: "los-angeles.png" },
  { name: "Minnesota", image: "minnesota.png" },
  { name: "Montreal", image: "montreal.png" },
  { name: "Nashville", image: "nashville.png" },
  { name: "New Jersey", image: "new-jersey.png" },
  { name: "New Island", image: "new-island.png" },
  { name: "New York", image: "new-york.png" },
  { name: "Ottawa", image: "ottawa.png" },
  { name: "Philadelphia", image: "philadelphia.png" },
  { name: "Pittsburgh", image: "pittsburgh.png" },
  { name: "San Jose", image: "san-jose.png" },
    { name: "Seattle", image: "seattle.png" },
  { name: "St. Louis", image: "st-louis.png" },
  { name: "Tampa Bay", image: "tampa-bay.png" },
  { name: "Toronto", image: "toronto.png" },
  { name: "Vancouver", image: "vancouver.png" },
  { name: "Vegas", image: "vegas.png" },
  { name: "Washington", image: "washington.png" },
  { name: "Winnipeg", image: "winnipeg.png" },
];

// Initialize web3 connection
const loadWeb3 = async () => {
    if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
    } else {
        window.alert("It seems you're using an old version of web3. Please upgrade to a modern browser with MetaMask installed.");
    }
};

const loadContract = async () => {
    const response = await fetch("assets/PuckCityV8.json");
    const data = await response.json();
    const networkType = await web3.eth.net.getNetworkType();
    const contractAddress = (networkType === 'test') ? CONTRACT_ADDRESS : "<your-contract-address-mainnet>";

    const contract = new web3.eth.Contract(data.abi, contractAddress);

    contract.events.ChainlinkFulfilled().on('data', async () => {
        console.log("Chainlink fulfilled event detected.");
        await debouncedRefreshData();
    });

    contract.events.TokenPurchased().on('data', async () => {
        console.log("Token purchased event detected.");
        await debouncedRefreshData();
    });

    contract.events.TokenClaimed().on('data', async () => {
        console.log("Token claimed event detected.");
        await debouncedRefreshData();
    });

    contract.events.GameResultUpdated().on('data', async () => {
        console.log("Game result updated event detected.");
        await debouncedRefreshData();
    });

    return contract;
};

const loadAccount = async () => {
    return (await web3.eth.getAccounts())[0];
};

const refreshData = async () => {
    const contract = await loadContract();
    const account = await loadAccount();
    const cityTokenBalanceElement = document.getElementById("cityTokenBalance");

    // Display token balances
    for (let i = 0; i < CITY_TOKENS.length; i++) {
        const teamTokenBalance = await contract.methods.balanceOf(account, i).call();
        const formattedBalance = web3.utils.fromWei(teamTokenBalance, "ether");
        cityTokenBalanceElement.textContent += `${CITY_TOKENS[i].name}: ${formattedBalance} Tokens\n`;
    }

    // Puck token balance
    const puckTokenBalance = await contract.methods.balanceOf(PUCK_TOKEN_ADDRESS, account).call();
    document.getElementById("puckTokenBalance").textContent = `${web3.utils.fromWei(puckTokenBalance, "ether")} PUCK`;

    // Display city tokens
    const teamTokenList = document.getElementById("teamTokenList");
    teamTokenList.innerHTML = ""; // Clear the existing list
    CITY_TOKENS.forEach(async (teamToken, index) => {
        const teamTokenBalance = await contract.methods.balanceOf(account, index).call();
        const teamTokenBalanceFormatted = web3.utils.fromWei(teamTokenBalance, "ether");

        // Only display tokens that the user actually owns
        if (teamTokenBalanceFormatted > 0) {
            const teamTokenItem = document.createElement("li");
            teamTokenItem.classList.add("list-group-item");

            const teamTokenImage = document.createElement("img");
            teamTokenImage.src = baseURI + teamToken.image;
            teamTokenImage.classList.add("team-token-image");

            const teamTokenName = document.createElement("span");
            teamTokenName.textContent = teamToken.name;
            teamTokenName.classList.add("team-token-name");

            const teamTokenBalanceElement = document.createElement("span");
            teamTokenBalanceElement.textContent = `${teamTokenBalanceFormatted} Tokens`;
            teamTokenBalanceElement.classList.add("team-token-balance");

            teamTokenItem.appendChild(teamTokenImage);
            teamTokenItem.appendChild(teamTokenName);
            teamTokenItem.appendChild(teamTokenBalanceElement);

            teamTokenList.appendChild(teamTokenItem);
        }
    });

    // Assuming the contract provides oraclePaymentAmount, jobId, and gameResults.
    const oraclePaymentAmount = await contract.methods.getOraclePaymentAmount().call();
    document.getElementById("oraclePaymentAmount").textContent = `${web3.utils.fromWei(oraclePaymentAmount, "ether")} ETH`;
    const jobId = await contract.methods.getJobId().call();
    document.getElementById("jobId").textContent = jobId;
    const gameResults = await contract.methods.getGameResults().call();
    document.getElementById("gameResults").textContent = gameResults;
};

// Debouncing mechanism to prevent multiple simultaneous calls to refreshData
let refreshDataTimeout = null;
const debouncedRefreshData = async () => {
    clearTimeout(refreshDataTimeout);
    refreshDataTimeout = setTimeout(() => {
        refreshData();
    }, 1000); // 1 second debounce
};

const stake = async (team, amount) => {
    try {
        const contract = await loadContract();
        const account = await loadAccount();
        const teamTokenIndex = CITY_TOKENS.findIndex(t => t.name === team);
        const amountInWei = web3.utils.toWei(amount, "ether");

        // Estimate gas before staking
        const gasEstimate = await contract.methods.stake(teamTokenIndex, amountInWei).estimateGas({ from: account });
        if (!confirm(`This operation may cost up to ${gasEstimate} gas. Do you wish to proceed?`)) return;

        await contract.methods.approve(CONTRACT_ADDRESS, teamTokenIndex, amountInWei).send({ from: account });
        await contract.methods.stake(teamTokenIndex, amountInWei).send({ from: account });

        await debouncedRefreshData();
    } catch (error) {
        console.error("Error staking tokens:", error);
        alert("Error staking tokens. See console for details.");
    }
};

const unstake = async (team, amount) => {
    try {
        const contract = await loadContract();
        const account = await loadAccount();
        const teamTokenIndex = CITY_TOKENS.findIndex(t => t.name === team);
        const amountInWei = web3.utils.toWei(amount, "ether");

        // Estimate gas before unstaking
        const gasEstimate = await contract.methods.unstake(teamTokenIndex, amountInWei).estimateGas({ from: account });
        if (!confirm(`This operation may cost up to ${gasEstimate} gas. Do you wish to proceed?`)) return;

        await contract.methods.unstake(teamTokenIndex, amountInWei).send({ from: account });
        await debouncedRefreshData();
    } catch (error) {
        console.error("Error unstaking tokens:", error);
        alert("Error unstaking tokens. See console for details.");
    }
};

const claim = async () => {
    try {
        const contract = await loadContract();
        const account = await loadAccount();

        // Estimate gas before claiming
        const gasEstimate = await contract.methods.claim().estimateGas({ from: account });
        if (!confirm(`This operation may cost up to ${gasEstimate} gas. Do you wish to proceed?`)) return;

        await contract.methods.claim().send({ from: account });
        await debouncedRefreshData();
    } catch (error) {
        console.error("Error claiming tokens:", error);
        alert("Error claiming tokens. See console for details.");
    }
};

const requestGameResult = async (teamId, gameId) => {
    try {
        const contract = await loadContract();
        const account = await loadAccount();

        // Estimate gas before requesting game result
        const gasEstimate = await contract.methods.requestGameResult(teamId, gameId).estimateGas({ from: account });
        if (!confirm(`This operation may cost up to ${gasEstimate} gas. Do you wish to proceed?`)) return;

        await contract.methods.requestGameResult(teamId, gameId).send({ from: account });
        await debouncedRefreshData();
    } catch (error) {
        console.error("Error requesting game result:", error);
        alert("Error requesting game result. See console for details.");
    }
};

const purchaseTokens = async (amount) => {
    try {
        const contract = await loadContract();
        const account = await loadAccount();
        const amountInWei = web3.utils.toWei(amount, "ether");

        await contract.methods.purchaseTokens(amountInWei).send({ from: account });
        await debouncedRefreshData();
    } catch (error) {
        console.error("Error purchasing tokens:", error);
        alert("Error purchasing tokens. See console for details.");
    }
};

window.addEventListener("load", async () => {
    await loadWeb3();
    await debouncedRefreshData();

    document.getElementById("stakingForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const amount = event.target.elements[0].value;
        const team = event.target.elements[1].value;
        await stake(team, amount);
        event.target.reset();
    });

    document.querySelectorAll(".unstake-button").forEach((unstakeButton) => {
        unstakeButton.addEventListener("click", async (event) => {
            const team = event.target.getAttribute("data-team");
            const amount = window.prompt(`Enter the amount of ${team} you want to unstake`);
            if (amount !== null) {
                await unstake(team, amount);
            }
        });
    });

    document.getElementById("claimButton").addEventListener("click", async () => {
        await claim();
    });

    document.getElementById("requestGameResultButton").addEventListener("click", async () => {
        const teamId = window.prompt("Enter the team ID:");
        const gameId = window.prompt("Enter the game ID:");
        if (teamId !== null && gameId !== null) {
            await requestGameResult(teamId, gameId);
        }
    });
});