import React, { useEffect, useState } from 'react';
import './App.css';
import { PetitionContractAbi__factory } from './contracts';
import { Provider, fromTai64ToUnix,BN } from 'fuels';
import CreateCampaignForm from './CreateCampaignForm';
import PetitionForm from './PetitionForm';
import Modal from './Modal';

const CONTRACT_ID = '0xe4cf05aa7c013a3c5dbb20ab3fa7737c0c5279abdf6832f300a6a9a5185403cb'; //Replace with your contract address

function App() {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);
  

   // Call this function to show the modal with the passed title and content
   const displayModal = (title: string, content: string) => {
    setModalTitle(title);
    setModalContent(content);
    setShowModal(true);
  };

  async function connect() {
    if (window.fuel) {
      try {
        await window.fuel.connect();
        const accounts = await window.fuel.accounts();
        if (accounts.length === 0) {
          throw new Error('No accounts found.');
        }
        setAccount(accounts[0]);
        setConnected(true);
      } catch (err) {
        console.error('error connecting: ', err);
      }
    } else {
      console.error('Fuel wallet is not available');
    }
  }

  async function checkConnection() {
    if (window.fuel) {
      const isConnected = await window.fuel.isConnected();
      setConnected(isConnected);
      if (isConnected) {
        const accounts = await window.fuel.accounts();
        setAccount(accounts[0]);
      }
    }
  }

  async function getDeadline(deadlineDays: number) {
    const provider = await Provider.create('https://beta-4.fuel.network/graphql');
    const block = await provider.getBlock('latest');
    if (!block || !block.time) {
      throw new Error('Failed to fetch the latest block or block timestamp.');
    }
    const currentTimestamp = fromTai64ToUnix(block.time);
    const oneDayInSeconds = 24 * 60 * 60;
    const deadline = currentTimestamp + (oneDayInSeconds * deadlineDays);
    console.log(deadline);
    return deadline;
  }

// Convert timestamp (BN) to formatted Date and Time string
function convertBNToDate(timestampBN: BN | undefined): string | null {
  // Check if timestampBN is undefined
  if (timestampBN === undefined) {
    return null;
  }
  // Convert the BN to a numeric value 
  const numericValueInMilliseconds = (Number(timestampBN.toString(10))) * 1000;
  const dateObject = new Date(numericValueInMilliseconds); 
  // Format the date and time using toLocaleString with appropriate options
  return dateObject.toLocaleString('en-US');
  } 

//Function to create campaign
async function createCampaign(deadline: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);
      const deadlineStamp = await getDeadline(deadline);
      const {logs} = await contract.functions.create_campaign(deadlineStamp).txParams({gasPrice:1}).call()
      // Assuming 'log' is the object containing your data
      const campaignLog = logs[0]; // This selects the first item if it's an array

      // Extracting the values
      const deadlineTimestamp = new Date((campaignLog.campaign_info?.deadline?.toString(10)) * 1000); // Convert BN to string to handle large numbers
      const campaignId = campaignLog.campaign_id?.toString(10); // Convert BN to string
      const progress = campaignLog.campaign_info?.state;
      displayModal("Campaign Created", `
      Deadline: ${deadlineTimestamp.toLocaleString('en-US')}
      Campaign ID: ${campaignId}
      Current State: ${progress}
    `);
    }
  }

//Function to sign the petition
  async function signPetition(campaignId: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);      
      const {logs} = await contract.functions.sign_petition(campaignId).txParams({gasPrice:1}).call();
      const signLog = logs[0];
      displayModal("Petition Signed", `Campaign ID Signed: ${signLog.campaign_id?.toString(10)}`);

    }
  }

  //Function to sign the petition
  async function cancelPetition(campaignId: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);      
      const {logs} = await contract.functions.cancel_campaign(campaignId).txParams({gasPrice:1}).call();
      const cancelLog = logs[0];
      displayModal("Campaign Cancelled", `Campaign ID Cancelled: ${cancelLog.campaign_id?.toString(10)}`);

    }
  }

   //Function to unsign the campaign
   async function unsignPetition(campaignId: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);      
      const {logs} = await contract.functions.unsign_petition(campaignId).txParams({gasPrice:1}).call()
      displayModal("Campaign Unsigned", `Campaign ID Unsigned: ${logs[0].campaign_id?.toString(10)}`);
    }
  }

 // Function to get the campaign info
  async function campaignInfo(campaignId: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);      
      const {value} = await contract.functions.campaign_info(campaignId).txParams({gasPrice:1}).call()
      const deadlineTimestamp = await convertBNToDate(value?.deadline);
      console.log(value?.deadline.toString());
      const state = value?.state;
      const signs = value?.total_signs.toString();
      displayModal("Campaign Info", `
      Deadline: ${deadlineTimestamp}
      Progress: ${state}
      Total Signs Received: ${signs}
    `);

    }
  }
  //Function to end the campaign
  async function endCampaign(campaignId: number) {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = PetitionContractAbi__factory.connect(CONTRACT_ID, wallet);      
      const {logs} = await contract.functions.end_campaign(campaignId).txParams({gasPrice:1}).call()
      const campaignLog = logs[0];
      const id = campaignLog.campaign_id?.toString(10);
      const total_sign = campaignLog.total_signs?.toString(10);
      displayModal("Campaign Ended", `
      Campaign ID: ${id}
      Total Signs Received: ${total_sign}
    `);
    }
  }
  return (
    <div className="App">
        <h1>Petition dApp</h1>
        {connected ? (
          <button onClick={() => setConnected(false)} className="disconnect-button">
            Disconnect Wallet
          </button>
        ) : (
          <button onClick={connect} className="connect-button">
            Connect Wallet
          </button>
        )}
      {connected && (
        <main className="App-main">
          <CreateCampaignForm onSubmit={createCampaign} />
          <div className="form-container">
            <PetitionForm onSubmit={signPetition} label="Sign" action="sign" />
            <PetitionForm onSubmit={endCampaign} label="End" action="end campaign" />
            <PetitionForm onSubmit={campaignInfo} label="Info" action="view campaign info" />
            <PetitionForm onSubmit={unsignPetition} label="Unsign" action="unsign" />
            <PetitionForm onSubmit={cancelPetition} label="Cancel" action="cancel" />
            <p className="footer-text">Powered by <a className="ref-link" href="http://metaschool.so/" target="_blank" rel="noopener noreferrer">metaschool 🔮</a></p>
          </div>
        </main>
      )}
      <Modal
        show={showModal}
        title={modalTitle}
        content={<pre>{modalContent}</pre>}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
      }  

export default App;
