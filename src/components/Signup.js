// SignUp.js
import React, { useState } from 'react';
import Web3 from 'web3';

function SignUp() {
    const [walletAddress, setWalletAddress] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleConnectWallet = async () => {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) throw new Error("No account connected");
            setWalletAddress(accounts[0]);
            setSuccessMessage('Wallet connected successfully!');
            setErrorMessage('');
        } catch (error) {
            setErrorMessage('Failed to connect wallet. Please try again.');
            setSuccessMessage('');
        }
    };

    return (
        <div>
            <button onClick={handleConnectWallet}>Connect Wallet</button>
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
        </div>
    );
}

export default SignUp;
