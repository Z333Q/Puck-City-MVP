import Web3 from 'web3';

let web3;

if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    try {
        window.ethereum.enable().then(function() {
            // User has allowed account access to DApp
        });
    } catch(e) {
        console.error("User denied account access");
    }
} 
else if (window.web3) {
    web3 = new Web3(window.web3.currentProvider);
}
else {
    alert('Please install MetaMask or use a different browser with Ethereum integration.');
}

export default web3;
