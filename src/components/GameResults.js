import React, { useState, useEffect } from 'react';
import web3 from './web3';  // Assuming you have a web3 instance
import contract from './contract';  // Your contract instance

const GameResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchResults = async () => {
            try {
                // Assuming the contract has a function to get the number of game results
                const totalResults = await contract.methods.getTotalGameResults().call();

                let fetchedResults = [];
                for (let i = 0; i < totalResults; i++) {
                    // Assuming the contract has a function to fetch a game result by its index
                    const result = await contract.methods.getGameResult(i).call();
                    fetchedResults.push(result);
                }

                setResults(fetchedResults);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching game results:", error);
                setLoading(false);
            }
        };

        fetchResults();
    }, []);

    const handleBenefit = async (gameId) => {
        try {
            const accounts = await web3.eth.getAccounts();

            // This is a placeholder method to benefit from game results. Replace with your contract's appropriate method.
            await contract.methods.benefitFromGameResult(gameId).send({ from: accounts[0] });

            setSuccessMessage('Successfully benefited from the game result!');
            setErrorMessage('');
        } catch (error) {
            setErrorMessage('Failed to benefit from the game result. Please try again.');
            setSuccessMessage('');
        }
    };

    return (
        <div>
            <h2>Game Results</h2>
            {loading ? (
                <p>Loading...</p>
            ) : (
                results.map((result, index) => (
                    <div key={index}>
                        <h3>Game {index + 1}</h3>
                        <p>Home Score: {result.homeScore}</p>
                        <p>Away Score: {result.awayScore}</p>
                        {/* ... other game details ... */}
                        <button onClick={() => handleBenefit(index)}>Benefit from Result</button>
                    </div>
                ))
            )}
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
        </div>
    );
}

export default GameResults;
