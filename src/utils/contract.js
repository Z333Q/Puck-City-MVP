import web3 from './web3';
import PuckCity from '../contracts/PuckCity.json';

const contractAddress = "YOUR_CONTRACT_ADDRESS";  // Replace with your deployed contract address
const contractInstance = new web3.eth.Contract(PuckCity.abi, contractAddress);

export default contractInstance;
