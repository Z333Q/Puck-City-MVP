import React, { useState } from 'react';
import Web3 from 'web3';

const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
const CONTRACT_ABI = []; // Your contract ABI

function SupportTeam() {
    const [amount, setAmount] = useState(0);
    const [teamId, setTeamId] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const web3 = new Web3(Web3.givenProvider || "http://localhost:8545"); 
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    const handleSupport = async () => {
        try {
            const accounts = await web3.eth.getAccounts();
            const currentPrice = await contract.methods.getCurrentPrice().call();
            const totalPrice = currentPrice * amount;
            await contract.methods.purchaseToken(amount, teamId).send({ from: accounts[0], value: totalPrice });
            setSuccessMessage('Support sent successfully!');
            setErrorMessage('');
        } catch (error) {
            setErrorMessage('Failed to send support. Please try again.');
            setSuccessMessage('');
        }
    };

    return (
        <div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
            <input type="number" value={teamId} onChange={e => setTeamId(e.target.value)} placeholder="Team ID" />
            <button onClick={handleSupport}>Support Team</button>
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
        </div>
    );
}

export default SupportTeam;
